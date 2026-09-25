import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { VENDOR_INVITES_COLLECTION, VENDOR_KYC_COLLECTION } from '../config/onboarding';
import type {
  AdminReview,
  BusinessInfo,
  FleetDetails,
  OnboardingSection,
  PayoutDetails,
  PayoutSummary,
  VendorDocuments,
  VendorProfile,
  VendorRecord,
  VendorStatus,
} from '../types';
import { withRetry, withTimeout } from '../utils/retry';

const VENDORS = 'vendors';

/** Statuses in which the vendor may edit and (re)submit the application. */
export const EDITABLE_STATUSES: VendorStatus[] = ['INCOMPLETE', 'CHANGES_REQUESTED', 'REJECTED'];

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw Object.assign(new Error('Your session has expired. Please sign in again.'), { code: 'unauthenticated' });
  return uid;
}

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value;
  const ts = value as { toMillis?: () => number };
  return typeof ts.toMillis === 'function' ? ts.toMillis() : null;
}

/**
 * Maps both the canonical statuses and the legacy ones written by earlier
 * versions of the vendor/admin panels ('Pending', 'Approved', 'Active', …).
 */
export function normalizeVendorStatus(data: DocumentData): VendorStatus {
  const raw = String(data.status ?? data.verificationStatus ?? '');
  switch (raw) {
    case 'INCOMPLETE':
    case 'PENDING_APPROVAL':
    case 'CHANGES_REQUESTED':
    case 'APPROVED':
    case 'REJECTED':
    case 'SUSPENDED':
      return raw;
    case 'Approved':
    case 'Active':
      return 'APPROVED';
    case 'Needs Correction':
      return 'CHANGES_REQUESTED';
    case 'Rejected':
      return 'REJECTED';
    case 'Suspended':
    case 'Blacklisted':
      return 'SUSPENDED';
    default:
      // Legacy 'Pending' docs were created by the old one-screen signup and
      // never collected documents — send them through the wizard.
      return data.submittedAt ? 'PENDING_APPROVAL' : 'INCOMPLETE';
  }
}

function mapReview(raw: unknown): AdminReview | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    note: typeof r.note === 'string' ? r.note : '',
    flaggedSections: Array.isArray(r.flaggedSections) ? (r.flaggedSections as OnboardingSection[]) : [],
    reviewedAt: toMillis(r.reviewedAt) ?? undefined,
  };
}

export function mapVendorRecord(uid: string, data: DocumentData): VendorRecord {
  return {
    uid,
    phone: data.phone || auth.currentUser?.phoneNumber || '',
    status: normalizeVendorStatus(data),
    onboardingStep: typeof data.onboardingStep === 'number' ? data.onboardingStep : 0,
    business: data.business ?? null,
    documents: data.documents ?? null,
    fleet: data.fleet ?? null,
    payoutSummary: data.payoutSummary ?? null,
    review: mapReview(data.review),
    submittedAt: toMillis(data.submittedAt),
  };
}

/** Shape consumed by the post-approval dashboard components. */
export function mapVendorProfile(uid: string, data: DocumentData): VendorProfile {
  const b: Partial<BusinessInfo> = data.business ?? {};
  const status = normalizeVendorStatus(data);
  return {
    id: uid,
    companyName: b.businessName || data.companyName || 'Vendor Partner',
    contactPerson: b.vendorName || data.contactPerson || '',
    phone: data.phone || '',
    email: b.email || data.email || '',
    gstin: data.gstin || '',
    panNumber: data.panNumber || '',
    address: b.address ? [b.address.line1, b.address.line2].filter(Boolean).join(', ') : data.address || '',
    city: b.address?.city || data.city || '',
    totalFleetSize: data.fleet?.fleetSize ?? data.totalFleetSize ?? 0,
    totalDriversCount: typeof data.totalDriversCount === 'number' ? data.totalDriversCount : 0,
    verificationStatus:
      status === 'APPROVED' ? 'Approved'
      : status === 'REJECTED' ? 'Rejected'
      : status === 'CHANGES_REQUESTED' ? 'Needs Correction'
      : 'Pending',
    joinedDate: data.joinedDate || '',
    bankAccountName: data.payoutSummary?.accountHolderName || '',
    bankAccountNumber: data.payoutSummary?.bankLast4 ? `••••${data.payoutSummary.bankLast4}` : '',
    ifscCode: data.payoutSummary?.ifsc || '',
    upiId: data.payoutSummary?.upiId || '',
  };
}

export interface VendorSnapshot {
  record: VendorRecord;
  profile: VendorProfile;
}

/**
 * Real-time listener on vendors/{uid}. Emits null while the doc does not
 * exist (brand-new signup). Drives all routing, so an admin approval flips
 * the vendor to the dashboard without a reload.
 */
export function subscribeToVendor(
  uid: string,
  onData: (snap: VendorSnapshot | null) => void,
  onError: (error: unknown) => void,
): () => void {
  return onSnapshot(
    doc(db, VENDORS, uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const data = snap.data();
      onData({ record: mapVendorRecord(uid, data), profile: mapVendorProfile(uid, data) });
    },
    onError,
  );
}

export interface VendorInvite {
  businessName: string;
  vendorName: string;
  email: string;
  city: string;
  preApproved: boolean;
}

/** Admin pre-registration keyed by E.164 phone. Absent/unreadable → null. */
export async function getVendorInvite(phoneE164: string): Promise<VendorInvite | null> {
  if (!phoneE164) return null;
  try {
    const snap = await withRetry(() => getDoc(doc(db, VENDOR_INVITES_COLLECTION, phoneE164)));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      businessName: d.companyName || d.businessName || '',
      vendorName: d.contactPerson || d.vendorName || '',
      email: d.email || '',
      city: d.city || '',
      preApproved: d.preApproved === true,
    };
  } catch {
    return null;
  }
}

export interface VendorKyc {
  identityNumber: string;
  payout: PayoutDetails | null;
}

/** Private KYC (full ID number + bank details) — owner and admin only. */
export async function getVendorKyc(): Promise<VendorKyc> {
  const uid = requireUid();
  const snap = await withRetry(() => getDoc(doc(db, VENDOR_KYC_COLLECTION, uid)));
  const d = snap.exists() ? snap.data() : {};
  return {
    identityNumber: d.identityProof?.number || '',
    payout: d.payout ?? null,
  };
}

const nextStep = (record: VendorRecord | null, completedIndex: number) =>
  Math.max(record?.onboardingStep ?? 0, completedIndex + 1);

/**
 * Step 1. Creates vendors/{uid} (status INCOMPLETE) on first save so the
 * wizard can be resumed from any device; later saves merge.
 */
export async function saveBusinessStep(record: VendorRecord | null, business: BusinessInfo): Promise<void> {
  const uid = requireUid();
  const summary = {
    business,
    companyName: business.businessName,
    name: business.businessName,
    contactPerson: business.vendorName,
    owner: business.vendorName,
    email: business.email,
    city: business.address.city,
    onboardingStep: nextStep(record, 0),
    updatedAt: serverTimestamp(),
  };
  const ref = doc(db, VENDORS, uid);
  if (!record) {
    await withTimeout(
      setDoc(ref, {
        ...summary,
        uid,
        role: 'vendor',
        phone: auth.currentUser?.phoneNumber || '',
        status: 'INCOMPLETE',
        createdAt: serverTimestamp(),
      }),
    );
  } else {
    await withTimeout(updateDoc(ref, summary));
  }
}

/** Step 2. Public doc keeps file paths + masked ID; full ID number goes to vendor_kyc. */
export async function saveDocumentsStep(
  record: VendorRecord,
  documents: VendorDocuments,
  identityNumber: string,
): Promise<void> {
  const uid = requireUid();
  const batch = writeBatch(db);
  batch.update(doc(db, VENDORS, uid), {
    documents,
    gstin: documents.businessRegistration.type === 'GST' ? documents.businessRegistration.number : '',
    panNumber: documents.identityProof.type === 'PAN' ? documents.identityProof.maskedNumber : '',
    onboardingStep: nextStep(record, 1),
    updatedAt: serverTimestamp(),
  });
  // Aadhaar: store only the masked form (UIDAI guidance); PAN/passport in full.
  batch.set(
    doc(db, VENDOR_KYC_COLLECTION, uid),
    {
      identityProof: {
        type: documents.identityProof.type,
        number: documents.identityProof.type === 'AADHAAR' ? documents.identityProof.maskedNumber : identityNumber,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await withTimeout(batch.commit());
}

/** Step 3. */
export async function saveFleetStep(record: VendorRecord, fleet: FleetDetails): Promise<void> {
  const uid = requireUid();
  await withTimeout(
    updateDoc(doc(db, VENDORS, uid), {
      fleet,
      fleetSize: fleet.fleetSize,
      totalFleetSize: fleet.fleetSize,
      onboardingStep: nextStep(record, 2),
      updatedAt: serverTimestamp(),
    }),
  );
}

/** Step 4. Full bank details → vendor_kyc; masked summary → vendors doc. */
export async function savePayoutStep(record: VendorRecord, payout: PayoutDetails): Promise<void> {
  const uid = requireUid();
  const summary: PayoutSummary = {
    accountHolderName: payout.accountHolderName,
    bankLast4: payout.accountNumber.slice(-4),
    ifsc: payout.ifsc,
    upiId: payout.upiId,
  };
  const batch = writeBatch(db);
  batch.set(doc(db, VENDOR_KYC_COLLECTION, uid), { payout, updatedAt: serverTimestamp() }, { merge: true });
  batch.update(doc(db, VENDORS, uid), {
    payoutSummary: summary,
    onboardingStep: nextStep(record, 3),
    updatedAt: serverTimestamp(),
  });
  await withTimeout(batch.commit());
}

/** Returns the sections that are still missing required data. */
export function missingSections(record: VendorRecord): OnboardingSection[] {
  const missing: OnboardingSection[] = [];
  if (!record.business?.businessName || !record.business?.vendorName) missing.push('business');
  const d = record.documents;
  if (!d || !d.businessRegistration?.files?.length || !d.identityProof?.files?.length) missing.push('documents');
  const f = record.fleet;
  if (!f || !f.vehicleTypes?.length || !f.rcFiles?.length || !f.vehiclePhotos?.length || !f.insuranceFiles?.length) {
    missing.push('fleet');
  }
  if (!record.payoutSummary?.bankLast4) missing.push('payout');
  return missing;
}

/**
 * Final step. Flips status to PENDING_APPROVAL (or straight to APPROVED when
 * an admin pre-approved this phone number via vendor_invites — the Firestore
 * rules verify that invite server-side).
 */
export async function submitForReview(record: VendorRecord, preApproved: boolean): Promise<void> {
  const uid = requireUid();
  const missing = missingSections(record);
  if (missing.length) throw new Error('Please complete every section before submitting.');
  if (!EDITABLE_STATUSES.includes(record.status)) {
    throw new Error('This application has already been submitted.');
  }
  const status: VendorStatus = preApproved && record.status === 'INCOMPLETE' ? 'APPROVED' : 'PENDING_APPROVAL';
  await withTimeout(
    updateDoc(doc(db, VENDORS, uid), {
      status,
      onboardingStep: 4,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
}

/** Approved vendors may update contact details only — never legal names or bank info. */
export async function updateApprovedContactInfo(
  business: BusinessInfo,
  changes: Pick<BusinessInfo, 'email' | 'altPhone' | 'address'>,
): Promise<void> {
  const uid = requireUid();
  const next: BusinessInfo = { ...business, ...changes };
  await withTimeout(
    updateDoc(doc(db, VENDORS, uid), {
      business: next,
      email: next.email,
      city: next.address.city,
      updatedAt: serverTimestamp(),
    }),
  );
}

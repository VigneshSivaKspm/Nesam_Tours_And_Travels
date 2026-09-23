import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

// Firebase's documented pattern is to keep a single RecaptchaVerifier alive and
// reuse it. Creating a new one on every "Send OTP" / "Resend" click throws
// "reCAPTCHA has already been rendered in this element".
let recaptchaVerifier: RecaptchaVerifier | null = null;
let recaptchaContainerId: string | null = null;

export function createRecaptchaVerifier(containerId: string): RecaptchaVerifier {
  if (recaptchaVerifier && recaptchaContainerId === containerId) {
    return recaptchaVerifier;
  }
  resetRecaptchaVerifier();
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  recaptchaContainerId = containerId;
  return recaptchaVerifier;
}

export function resetRecaptchaVerifier(): void {
  try {
    recaptchaVerifier?.clear();
  } catch {
    /* widget may already be gone */
  }
  recaptchaVerifier = null;
  recaptchaContainerId = null;
}

export async function sendOtpToPhone(
  phoneE164: string,
  verifier: RecaptchaVerifier,
): Promise<ConfirmationResult> {
  try {
    return await signInWithPhoneNumber(auth, phoneE164, verifier);
  } catch (error) {
    // A failed attempt consumes the reCAPTCHA token; force a fresh widget next time.
    resetRecaptchaVerifier();
    throw error;
  }
}

export async function confirmOtpCode(
  confirmation: ConfirmationResult,
  code: string,
): Promise<User> {
  const credential = await confirmation.confirm(code);
  return credential.user;
}

export function subscribeToAuthUser(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export function describePhoneAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Enter a valid 10-digit mobile number.';
    case 'auth/missing-phone-number':
      return 'Please enter your mobile number.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/invalid-verification-code':
      return 'Incorrect OTP. Please check and try again.';
    case 'auth/code-expired':
      return 'This OTP has expired. Please request a new one.';
    case 'auth/missing-verification-code':
      return 'Please enter the 6-digit OTP.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/quota-exceeded':
      return 'SMS limit reached for now. Please try again later.';
    case 'auth/operation-not-allowed':
      return 'Phone sign-in is not enabled for this project. Contact support.';
    case 'auth/unauthorized-domain':
      return 'This site is not authorised for sign-in. Contact support.';
    case 'auth/captcha-check-failed':
    case 'auth/invalid-app-credential':
      return 'Verification check failed. Please reload the page and try again.';
    case 'auth/billing-not-enabled':
      return 'Phone verification is temporarily unavailable. Contact support.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

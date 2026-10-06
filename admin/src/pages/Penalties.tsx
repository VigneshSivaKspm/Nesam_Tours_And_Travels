import { useEffect, useMemo, useState } from "react";
import type { Booking, Driver, PenaltyRecord, Vendor } from "../types";
import { subscribeBookings, subscribeDrivers, subscribePenalties, subscribeVendors } from "../services/adminFirestoreService";
import {
  ACTIONS, OUTSTANDING_STATUSES, PENALTY_CATEGORIES, PENALTY_STATUSES, PenaltyActionError, availableActions, createPenalty, mapPenalty, transitionPenalty, validatePenalty,
  type Penalty, type PenaltyAction, type PenaltyErrors, type PenaltyInput, type PenaltyParty,
} from "../services/penaltyService";
import { normalizeVendorStatus } from "../utils/vendorStatus";
import { ErrorBanner, Modal, Toast, useToast } from "../components/Feedback";
import { Field, Notice, inputCls, primaryBtn, secondaryBtn } from "../components/FormKit";
import { useCan } from "../components/AccessContext";
import { formatDateTime12 } from "../utils/time";

const STATUS_CLS: Record<string, string> = {
  Pending: "text-yellow-900 bg-yellow-50 border-yellow-300",
  Acknowledged: "text-blue-900 bg-blue-50 border-blue-300",
  Disputed: "text-orange-900 bg-orange-50 border-orange-300",
  Paid: "text-green-900 bg-green-50 border-green-300",
  Deducted: "text-green-900 bg-green-50 border-green-300",
  Waived: "text-gray-700 bg-gray-100 border-gray-300",
};
const PARTY_CLS: Record<PenaltyParty, string> = { Driver: "bg-blue-50 text-blue-800 border-blue-300", Vendor: "bg-purple-50 text-purple-800 border-purple-300" };

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const vendorLabel = (v: Vendor) => v.companyName || (v as Vendor & { business?: { businessName?: string } }).business?.businessName || v.name || v.id;
const errText = (e: unknown) => (e instanceof PenaltyActionError ? e.message : "Something went wrong. Please try again.");

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const content = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const blankInput = (): PenaltyInput => ({ party: "Driver", partyId: "", partyName: "", category: "", reason: "", description: "", amount: "", customerCompensation: "", bookingId: "", incidentDate: today() });

export default function Penalties() {
  const [raw, setRaw] = useState<PenaltyRecord[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const canIssue = useCan("compliance");
  const canMoney = useCan("finance");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Outstanding" | Penalty["status"]>("All");
  const [partyFilter, setPartyFilter] = useState<"All" | PenaltyParty>("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [issuing, setIssuing] = useState(false);
  const [viewing, setViewing] = useState<Penalty | null>(null);
  const [action, setAction] = useState<{ penalty: Penalty; action: PenaltyAction } | null>(null);
  const { toast, show } = useToast();

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const fail = (m: string) => { setLoadError(m); setLoading(false); };
    const unsubs = [
      subscribePenalties((d) => { setRaw(d); setLoading(false); }, fail),
      subscribeDrivers(setDrivers, fail),
      subscribeVendors(setVendors, fail),
      subscribeBookings(setBookings, fail),
    ];
    return () => unsubs.forEach((u) => u());
  }, [retryKey]);

  const penalties = useMemo(() => raw.map((p) => mapPenalty(p as PenaltyRecord & Record<string, unknown>)).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)), [raw]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromT = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toT = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
    return penalties.filter((p) => {
      if (partyFilter !== "All" && p.party !== partyFilter) return false;
      if (statusFilter === "Outstanding" ? !OUTSTANDING_STATUSES.includes(p.status) : statusFilter !== "All" && p.status !== statusFilter) return false;
      const t = new Date(`${p.incidentDate}T12:00:00`).getTime() || p.createdAt?.getTime();
      if (fromT !== null && (!t || t < fromT)) return false;
      if (toT !== null && (!t || t > toT)) return false;
      return !q || [p.partyName, p.partyId, p.reason, p.category, p.bookingCode, p.id].some((v) => v.toLowerCase().includes(q));
    });
  }, [penalties, search, statusFilter, partyFilter, from, to]);

  const stats = useMemo(() => {
    const outstanding = penalties.filter((p) => OUTSTANDING_STATUSES.includes(p.status));
    return {
      total: penalties.length,
      outstandingAmount: outstanding.reduce((s, p) => s + p.amount, 0),
      awaitingAck: penalties.filter((p) => p.status === "Pending").length,
      disputed: penalties.filter((p) => p.status === "Disputed").length,
    };
  }, [penalties]);

  const exportCsv = () =>
    downloadCsv(
      `nesam_penalties_${today()}.csv`,
      ["Penalty ID", "Party", "Name", "Category", "Reason", "Amount", "Incident date", "Booking", "Status", "Acknowledged at", "Issued by"],
      filtered.map((p) => [p.id, p.party, p.partyName, p.category, p.reason, p.amount, p.incidentDate, p.bookingCode, p.status, p.acknowledgedAt ? formatDateTime12(p.acknowledgedAt) : "", p.issuedByName]),
    );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Toast toast={toast} />
      {loadError && <ErrorBanner message={loadError} onRetry={() => setRetryKey((k) => k + 1)} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111]">Penalties & Disputes</h1>
          <p className="text-sm text-[#555]">Penalties issued to drivers and vendors. The partner is shown the penalty and asked to acknowledge that they have read it, and can dispute it.</p>
        </div>
        {canIssue && <button onClick={() => setIssuing(true)} className={primaryBtn}>+ Issue penalty</button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total penalties", value: String(stats.total) },
          { label: "Outstanding amount", value: rupees(stats.outstandingAmount) },
          { label: "Not yet acknowledged", value: String(stats.awaitingAck) },
          { label: "Open disputes", value: String(stats.disputed) },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
            <div className="text-2xl font-bold text-[#111]">{loading ? "—" : s.value}</div>
            <div className="text-sm text-[#555] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E5E5] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, reason, booking…" aria-label="Search penalties" className={`${inputCls} min-w-[14rem] !w-auto`} />
            <select aria-label="Party" value={partyFilter} onChange={(e) => setPartyFilter(e.target.value as typeof partyFilter)} className={`${inputCls} !w-auto`}>
              <option value="All">Drivers & vendors</option>
              <option value="Driver">Drivers</option>
              <option value="Vendor">Vendors</option>
            </select>
            <select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={`${inputCls} !w-auto`}>
              <option value="All">All statuses</option>
              <option value="Outstanding">Outstanding</option>
              {PENALTY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="date" aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} !w-auto`} />
            <input type="date" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} !w-auto`} />
            {from && to && from > to && <span className="text-xs font-semibold text-red-700">Start date is after end date.</span>}
          </div>
          <button onClick={exportCsv} disabled={filtered.length === 0} className={secondaryBtn}>Export CSV</button>
        </div>

        {loading && <div className="py-12 text-center text-sm text-[#555]" role="status">Loading penalties…</div>}
        {!loading && filtered.length === 0 && <div className="py-12 text-center text-sm text-[#555]">{penalties.length === 0 ? "No penalties recorded." : "No penalties match your filters."}</div>}

        {!loading && filtered.length > 0 && (
          <ul className="divide-y divide-[#F0F0F0]">
            {filtered.map((p) => (
              <li key={p.id} className="p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PARTY_CLS[p.party]}`}>{p.party}</span>
                    <span className="text-sm font-bold text-[#111]">{p.partyName || p.partyId}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_CLS[p.status]}`}>{p.status}</span>
                    {p.acknowledged && <span className="text-xs text-green-800 font-semibold">✓ read {p.acknowledgedAt ? formatDateTime12(p.acknowledgedAt) : ""}</span>}
                  </div>
                  <div className="text-sm text-[#222]"><strong>{p.category}</strong> — {p.reason}</div>
                  <div className="text-xs text-[#555]">Incident {p.incidentDate || "—"}{p.bookingCode ? ` · booking ${p.bookingCode}` : ""}{p.issuedByName ? ` · issued by ${p.issuedByName}` : ""}</div>
                </div>
                <div className="flex md:flex-col items-end md:items-end justify-between gap-2">
                  <div className="text-lg font-bold text-[#E21B23]">{rupees(p.amount)}</div>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    <button onClick={() => setViewing(p)} className="text-xs px-2.5 py-1.5 rounded-md border border-[#D4D4D4] font-semibold text-[#111] hover:bg-gray-50">Details</button>
                    {availableActions(p).filter((a) => (a === "Paid" || a === "Deducted" ? canMoney : canIssue)).map((a) => (
                      <button key={a} onClick={() => setAction({ penalty: p, action: a })} className="text-xs px-2.5 py-1.5 rounded-md border border-[#D4D4D4] font-semibold text-[#333] hover:bg-gray-50">{ACTIONS[a].label}</button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {issuing && <IssuePenaltyModal drivers={drivers} vendors={vendors} bookings={bookings} onClose={() => setIssuing(false)} onSaved={(m) => { setIssuing(false); show(m); }} />}
      {action && <PenaltyActionModal penalty={action.penalty} action={action.action} onClose={() => setAction(null)} onDone={(m) => { setAction(null); show(m); }} />}
      {viewing && <PenaltyDetails penalty={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function PenaltyDetails({ penalty: p, onClose }: { penalty: Penalty; onClose: () => void }) {
  const rows: [string, string][] = [
    ["Category", p.category], ["Reason", p.reason], ["Additional description", p.description || "—"], ["Amount", rupees(p.amount)],
    ["Customer compensation", p.customerCompensation ? rupees(p.customerCompensation) : "—"], ["Incident date", p.incidentDate || "—"], ["Booking", p.bookingCode || "—"],
    ["Status", p.status], ["Issued by", p.issuedByName || "—"], ["Issued", p.createdAt ? formatDateTime12(p.createdAt) : "—"],
    ["Acknowledged", p.acknowledged ? `${p.acknowledgedByName || "Partner"} · ${p.acknowledgedAt ? formatDateTime12(p.acknowledgedAt) : ""}` : "Not yet"],
    ...(p.acknowledgementText ? [["Acknowledgement text", `“${p.acknowledgementText}”`] as [string, string]] : []),
    ...(p.disputeNote ? [["Dispute", p.disputeNote] as [string, string]] : []),
    ["Payment reference", p.paymentReference || "—"], ["Resolution note", p.resolutionNote || "—"],
  ];
  return (
    <Modal title={`Penalty ${p.id.slice(0, 8)}`} subtitle={`${p.party} · ${p.partyName || p.partyId}`} onClose={onClose} size="lg">
      <div className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 p-2.5 bg-gray-50 rounded-lg"><span className="text-[#555]">{k}</span><span className="font-semibold text-[#111] text-right break-words">{v}</span></div>
        ))}
        {p.history.length > 0 && (
          <div className="pt-2"><div className="text-xs font-bold uppercase text-[#555] mb-1">History</div>
            <ul className="space-y-1">{p.history.map((h, i) => <li key={i} className="text-xs text-[#333]">{h.status} · {h.byName || "—"} · {formatDateTime12(h.at as never)}{h.note ? ` — ${h.note}` : ""}{h.reference ? ` (ref ${h.reference})` : ""}</li>)}</ul></div>
        )}
        <p className="text-xs text-[#555] pt-1">“Acknowledged” records that the person read the penalty. It is not an admission; they can still dispute it.</p>
      </div>
    </Modal>
  );
}

function IssuePenaltyModal({ drivers, vendors, bookings, onClose, onSaved }: { drivers: Driver[]; vendors: Vendor[]; bookings: Booking[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [input, setInput] = useState<PenaltyInput>(blankInput);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors: PenaltyErrors = useMemo(() => validatePenalty(input, bookings), [input, bookings]);
  const err = (k: keyof PenaltyInput) => (submitted && errors[k] ? errors[k] : null);
  const parties = input.party === "Driver"
    ? drivers.filter((d) => d.status === "Approved").map((d) => ({ id: d.id, name: d.name || d.id, sub: d.phone || "" }))
    : vendors.filter((v) => ["APPROVED", "SUSPENDED"].includes(normalizeVendorStatus(v))).map((v) => ({ id: v.id, name: vendorLabel(v), sub: v.phone || "" }));
  const partyBookings = input.partyId
    ? bookings.filter((b) => (input.party === "Driver" ? b.assignedDriverId : b.assignedVendorId) === input.partyId).sort((a, b) => String(b.bookingId || b.id).localeCompare(String(a.bookingId || a.id)))
    : [];

  const save = async () => {
    setSubmitted(true);
    setError(null);
    if (Object.keys(errors).length) return setError("Please fix the highlighted fields.");
    if (busy) return;
    setBusy(true);
    try {
      await createPenalty(input, bookings);
      onSaved(`Penalty issued to ${input.partyName}. They will be asked to acknowledge it.`);
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  };

  return (
    <Modal title="Issue penalty" subtitle="The partner is notified and must acknowledge that they have read it." onClose={onClose} busy={busy} size="lg"
      footer={<><button onClick={onClose} disabled={busy} className={secondaryBtn}>Cancel</button><button onClick={() => void save()} disabled={busy} className={primaryBtn}>{busy ? "Issuing…" : "Issue penalty"}</button></>}>
      <div className="space-y-3">
        {error && <Notice tone="error">{error}</Notice>}
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Penalty for">
          {(["Driver", "Vendor"] as PenaltyParty[]).map((party) => (
            <button key={party} type="button" onClick={() => setInput({ ...input, party, partyId: "", partyName: "", bookingId: "" })}
              className={`p-2.5 rounded-lg text-sm font-semibold border ${input.party === party ? "bg-red-50 text-[#E21B23] border-[#E21B23]" : "bg-white text-[#333] border-[#D4D4D4]"}`}>{party}</button>
          ))}
        </div>
        <Field label={input.party} required error={err("partyId")}>
          <select value={input.partyId} onChange={(e) => { const p = parties.find((x) => x.id === e.target.value); setInput({ ...input, partyId: e.target.value, partyName: p?.name || "", bookingId: "" }); }} className={inputCls}>
            <option value="">Choose {input.party.toLowerCase()}</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sub ? ` (${p.sub})` : ""}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Category" required error={err("category")}>
            <select value={input.category} onChange={(e) => setInput({ ...input, category: e.target.value })} className={inputCls}>
              <option value="">Choose</option>
              {PENALTY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Incident date" required error={err("incidentDate")}><input type="date" max={today()} value={input.incidentDate} onChange={(e) => setInput({ ...input, incidentDate: e.target.value })} className={inputCls} /></Field>
          <Field label="Penalty amount (₹)" required error={err("amount")}><input inputMode="numeric" value={input.amount} onChange={(e) => setInput({ ...input, amount: e.target.value.replace(/\D/g, "").slice(0, 6) })} className={`${inputCls} font-semibold`} /></Field>
          <Field label="Customer compensation (₹)" hint="Optional — part of the penalty passed to the customer." error={err("customerCompensation")}><input inputMode="numeric" value={input.customerCompensation} onChange={(e) => setInput({ ...input, customerCompensation: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="0" className={inputCls} /></Field>
        </div>
        <Field label="Related booking / trip" error={err("bookingId")}>
          <select value={input.bookingId} onChange={(e) => setInput({ ...input, bookingId: e.target.value })} disabled={!input.partyId} className={inputCls}>
            <option value="">{input.partyId ? "Not linked to a booking" : `Choose the ${input.party.toLowerCase()} first`}</option>
            {partyBookings.map((b) => <option key={b.id} value={b.id}>{b.bookingId || b.id} — {b.pickup} → {b.drop} ({b.status})</option>)}
          </select>
        </Field>
        <Field label="Reason" required error={err("reason")} hint="Shown to the partner."><textarea rows={2} value={input.reason} onChange={(e) => setInput({ ...input, reason: e.target.value })} maxLength={500} className={inputCls} /></Field>
        <Field label="Additional description" hint="Optional — more detail or evidence reference; also shown to the partner."><textarea rows={2} value={input.description} onChange={(e) => setInput({ ...input, description: e.target.value })} maxLength={1000} className={inputCls} /></Field>
      </div>
    </Modal>
  );
}

function PenaltyActionModal({ penalty, action, onClose, onDone }: { penalty: Penalty; action: PenaltyAction; onClose: () => void; onDone: (m: string) => void }) {
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spec = ACTIONS[action];
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await transitionPenalty(penalty, action, note, reference);
      onDone(`Penalty for ${penalty.partyName || penalty.partyId} updated.`);
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  };
  return (
    <Modal title={spec.label} subtitle={`${penalty.partyName || penalty.partyId} · ${rupees(penalty.amount)} · ${penalty.category}`} onClose={onClose} busy={busy}
      footer={<><button onClick={onClose} disabled={busy} className={secondaryBtn}>Cancel</button><button onClick={() => void submit()} disabled={busy} className={primaryBtn}>{busy ? "Saving…" : spec.label}</button></>}>
      <div className="space-y-3 text-sm">
        {error && <Notice tone="error">{error}</Notice>}
        <p className="text-[#444]">{spec.help}</p>
        {spec.needsReference && <Field label="Payment reference" required><input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className={inputCls} /></Field>}
        <Field label={spec.noteLabel} required={spec.needsNote}><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputCls} /></Field>
      </div>
    </Modal>
  );
}

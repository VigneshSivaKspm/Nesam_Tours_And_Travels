import { useEffect, useMemo, useState } from "react";
import type { TravelService, VehicleCategory } from "../types";
import { subscribeServices, subscribeVehicleCategories } from "../services/adminFirestoreService";
import {
  CommissionActionError,
  formFromPolicy,
  parseRate,
  rebuildPartnerLedger,
  saveCommissionPolicy,
  subscribeCommissionPolicy,
  validateCommissionForm,
  type CommissionForm,
  type CommissionPolicy as Policy,
  type LedgerRebuildReport,
} from "../services/commissionService";
import { ConfirmDialog, ErrorBanner, Toast, useToast } from "../components/Feedback";
import { useAccess } from "../components/AccessContext";

const errText = (e: unknown) => (e instanceof CommissionActionError ? e.message : "Something went wrong. Please try again.");
const inputCls = (bad: boolean) =>
  `w-24 px-2 py-1.5 text-[12px] border rounded-lg text-right ${bad ? "border-red-400 bg-red-50" : "border-[#DDD]"}`;
const BASE_LABEL = { taxable: "fare excluding GST", total: "fare including GST" } as const;

function sameForm(a: CommissionForm, b: CommissionForm) {
  const norm = (m: Record<string, string>) =>
    JSON.stringify(Object.entries(m).filter(([, v]) => v.trim()).map(([k, v]) => [k, Number(v)]).sort());
  return a.base === b.base && a.global.trim() === b.global.trim() && norm(a.services) === norm(b.services) && norm(a.categories) === norm(b.categories);
}

export default function CommissionPolicy() {
  const access = useAccess();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [docExists, setDocExists] = useState(false);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [services, setServices] = useState<TravelService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [form, setForm] = useState<CommissionForm>(() => formFromPolicy(null));
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [report, setReport] = useState<LedgerRebuildReport | null>(null);
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const { toast, show } = useToast();

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const fail = (m: string) => {
      setLoadError(m);
      setLoading(false);
    };
    const unsubs = [
      subscribeCommissionPolicy((p, exists) => {
        setPolicy(p);
        setDocExists(exists);
        setLoading(false);
      }, fail),
      subscribeVehicleCategories(setCategories, fail),
      subscribeServices(setServices, fail),
    ];
    return () => unsubs.forEach((u) => u());
  }, [retryKey]);

  // Load the stored policy into the form the first time, and whenever it
  // changes while the form has no unsaved edits.
  const stored = useMemo(() => formFromPolicy(policy), [policy]);
  const version = policy?.version ?? 0;
  const dirty = !sameForm(form, stored);
  useEffect(() => {
    if (loading) return;
    if (loadedVersion === null || (!dirty && loadedVersion !== version)) {
      setForm(stored);
      setLoadedVersion(version);
    }
  }, [loading, stored, version, loadedVersion, dirty]);
  const staleEdit = loadedVersion !== null && loadedVersion !== version && dirty;

  const { errors, policy: valid } = validateCommissionForm(form);
  const setRate = (kind: "services" | "categories", id: string, v: string) => setForm((f) => ({ ...f, [kind]: { ...f[kind], [id]: v } }));

  const draftPreview = (scope: { serviceId?: string; categoryId?: string }) => {
    const g = parseRate(form.global);
    const s = scope.serviceId ? parseRate(form.services[scope.serviceId] ?? "") : null;
    const c = scope.categoryId ? parseRate(form.categories[scope.categoryId] ?? "") : null;
    if (typeof s === "number") return `${s}% (service rule)`;
    if (typeof c === "number") return `${c}% (category rule)`;
    if (typeof g === "number") return `${g}% (global rule)`;
    return null;
  };

  const activeCategories = categories.filter((c) => c.status === "Active");
  const uncovered = activeCategories.filter((c) => draftPreview({ categoryId: c.id }) === null);
  // Rules kept for records that are no longer listed (deleted category/service).
  const orphanRules = [
    ...Object.keys(form.categories).filter((id) => form.categories[id].trim() && !categories.some((c) => c.id === id)).map((id) => ({ kind: "categories" as const, id })),
    ...Object.keys(form.services).filter((id) => form.services[id].trim() && !services.some((s) => s.id === id)).map((id) => ({ kind: "services" as const, id })),
  ];

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    setActionError(null);
    try {
      const v = await saveCommissionPolicy(valid, version);
      setLoadedVersion(v);
      setConfirm(false);
      show(`Commission policy saved (version ${v}). It applies to bookings created from now on.`);
    } catch (e) {
      setActionError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const runRebuild = async (dryRun: boolean) => {
    setBusy(true);
    setActionError(null);
    try {
      const r = await rebuildPartnerLedger(dryRun);
      setReport(r);
      setConfirmRebuild(false);
      if (!dryRun) show("Partner ledger updated for the listed records.");
    } catch (e) {
      if (dryRun) show(errText(e), "error");
      else setActionError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const configured = policy !== null && (policy.global !== null || Object.keys(policy.categories).length > 0 || Object.keys(policy.services).length > 0);

  return (
    <div className="p-6 space-y-5">
      <Toast toast={toast} />
      {loadError && <ErrorBanner message={loadError} onRetry={() => setRetryKey((k) => k + 1)} />}

      <div>
        <h1 className="text-[20px] font-bold text-[#111]">Commission Policy</h1>
        <p className="text-[13px] text-[#666]">
          The platform commission decides the payout offered to vendors and independent drivers. Each booking stores the rate it was created with, so a change here
          never alters existing bookings or completed trips.
        </p>
      </div>

      {!loading && !configured && (
        <div role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50 text-[13px] text-red-800">
          <strong>Not configured.</strong> {docExists ? "The stored policy is incomplete or invalid." : "No commission policy has been saved yet."} New bookings are refused until
          a rate applies to them.
        </div>
      )}
      {staleEdit && (
        <div role="alert" className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-[12px] text-amber-800 flex items-center justify-between gap-3">
          <span>Someone else saved a new version while you were editing. Saving now will be refused.</span>
          <button type="button" className="underline shrink-0" onClick={() => { setForm(stored); setLoadedVersion(version); }}>Load the latest version</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px] font-bold text-[#111]">Platform rules</div>
          <div className="text-[11px] text-[#888]">
            {policy ? `Version ${policy.version}${policy.updatedByName ? ` • saved by ${policy.updatedByName}` : ""}${policy.updatedAt ? ` • ${policy.updatedAt.toLocaleString("en-IN")}` : ""}` : "No saved version"}
          </div>
        </div>
        <fieldset>
          <legend className="text-[12px] font-semibold text-[#333] mb-1">Commission is taken from</legend>
          <div className="flex flex-wrap gap-4 text-[12px]">
            {(["taxable", "total"] as const).map((b) => (
              <label key={b} className="flex items-center gap-2">
                <input type="radio" name="base" checked={form.base === b} onChange={() => setForm((f) => ({ ...f, base: b }))} />
                The {BASE_LABEL[b]}
              </label>
            ))}
          </div>
          {errors.base && <p className="text-[11px] text-red-600 mt-1">{errors.base}</p>}
        </fieldset>
        <label className="block text-[12px]">
          <span className="font-semibold text-[#333]">Global rate (%)</span>
          <span className="block text-[11px] text-[#888] mb-1">Used when no service or vehicle category rule applies. Leave blank for no global rule.</span>
          <input inputMode="decimal" aria-label="Global rate" value={form.global} onChange={(e) => setForm((f) => ({ ...f, global: e.target.value }))} className={inputCls(!!errors.global)} />
          {errors.global && <span className="block text-[11px] text-red-600 mt-1">{errors.global}</span>}
        </label>
        {form.base && typeof parseRate(form.global) === "number" && (
          <p className="text-[11px] text-[#666]">
            Example: on a trip whose {BASE_LABEL[form.base]} is ₹1,000, the partner is offered ₹{Math.max(0, Math.round((1000 * (100 - (parseRate(form.global) as number))) / 100)).toLocaleString("en-IN")} under the global rule.
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <div className="text-[13px] font-bold text-[#111]">Vehicle category rules</div>
          <p className="text-[11px] text-[#888]">Override the global rate for a category. Blank = use the global rate.</p>
        </div>
        <table className="w-full">
          <tbody>
            {categories.map((c) => {
              const key = `category:${c.id}`;
              const applied = draftPreview({ categoryId: c.id });
              return (
                <tr key={c.id} className="border-b border-[#F5F5F5] last:border-0">
                  <td className="px-5 py-2.5 text-[12px] font-semibold text-[#111]">
                    {c.name}
                    {c.status !== "Active" && <span className="ml-2 text-[10px] font-normal text-[#999]">Inactive</span>}
                  </td>
                  <td className="px-5 py-2.5">
                    <input inputMode="decimal" aria-label={`${c.name} rate`} value={form.categories[c.id] ?? ""} onChange={(e) => setRate("categories", c.id, e.target.value)} className={inputCls(!!errors[key])} />
                  </td>
                  <td className={`px-5 py-2.5 text-[11px] ${applied ? "text-[#666]" : "text-red-700 font-semibold"}`}>{applied ? `Applies: ${applied}` : "No rate — bookings refused"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && categories.length === 0 && <div className="py-8 text-center text-[12px] text-[#999]">No vehicle categories yet.</div>}
      </div>

      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <div className="text-[13px] font-bold text-[#111]">Service rules</div>
          <p className="text-[11px] text-[#888]">
            Most specific rule. Applied to bookings created with a service selected (admin bookings). Customer app bookings use the vehicle category or global rule.
          </p>
        </div>
        <table className="w-full">
          <tbody>
            {services.map((s) => {
              const key = `service:${s.id}`;
              return (
                <tr key={s.id} className="border-b border-[#F5F5F5] last:border-0">
                  <td className="px-5 py-2.5 text-[12px] font-semibold text-[#111]">
                    {s.name}
                    {s.status !== "Active" && <span className="ml-2 text-[10px] font-normal text-[#999]">Inactive</span>}
                  </td>
                  <td className="px-5 py-2.5">
                    <input inputMode="decimal" aria-label={`${s.name} rate`} value={form.services[s.id] ?? ""} onChange={(e) => setRate("services", s.id, e.target.value)} className={inputCls(!!errors[key])} />
                  </td>
                  <td className="px-5 py-2.5 text-[11px] text-[#666]">{form.services[s.id]?.trim() ? "Overrides category and global rules" : "Not set"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && services.length === 0 && <div className="py-8 text-center text-[12px] text-[#999]">No services yet.</div>}
      </div>

      {orphanRules.length > 0 && (
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-[12px] text-amber-800 space-y-1">
          <div>Rules for records that no longer exist:</div>
          {orphanRules.map((r) => (
            <div key={`${r.kind}:${r.id}`} className="flex items-center gap-3">
              <span className="font-mono">{r.kind === "categories" ? "Category" : "Service"} {r.id}: {form[r.kind][r.id]}%</span>
              <button type="button" className="underline" onClick={() => setRate(r.kind, r.id, "")}>Remove</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!dirty || !valid || busy || staleEdit}
          onClick={() => { setActionError(null); setConfirm(true); }}
          className="px-5 py-2 rounded-lg text-[12px] font-bold text-white bg-[#E21B23] hover:bg-[#c4151c] disabled:opacity-40"
        >
          Save policy
        </button>
        <button type="button" disabled={!dirty || busy} onClick={() => setForm(stored)} className="px-4 py-2 border border-[#E5E5E5] rounded-lg text-[12px] font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40">
          Discard changes
        </button>
        {dirty && !valid && <span className="text-[11px] text-red-600">Fix the highlighted fields.</span>}
        {valid && uncovered.length > 0 && <span className="text-[11px] text-amber-700">{uncovered.length} active categor{uncovered.length === 1 ? "y has" : "ies have"} no rate and cannot be booked.</span>}
      </div>

      {access.isSuper && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5 space-y-3">
          <div>
            <div className="text-[13px] font-bold text-[#111]">Partner ledger maintenance</div>
            <p className="text-[11px] text-[#888]">
              Adds finance records and ledger entries for completed trips and payout requests created before the ledger existed. A check changes nothing; applying
              only adds missing records and never edits finalized ones.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void runRebuild(true)} className="px-4 py-2 border border-[#E5E5E5] rounded-lg text-[12px] font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40">
              {busy && !confirmRebuild ? "Checking…" : "Check what is missing"}
            </button>
            {report?.dryRun && (report.tripsToFinalize + report.tripEntriesToCreate + report.payoutEntriesToCreate > 0) && (
              <button type="button" disabled={busy} onClick={() => { setActionError(null); setConfirmRebuild(true); }} className="px-4 py-2 rounded-lg text-[12px] font-bold text-white bg-[#111] disabled:opacity-40">
                Apply
              </button>
            )}
          </div>
          {report && (
            <div className="text-[12px] text-[#444] space-y-1">
              <div className="font-semibold">{report.dryRun ? "Check result (nothing changed)" : "Applied"}</div>
              <div>Trips to finalize: {report.tripsToFinalize} • Trip earnings to record: {report.tripEntriesToCreate} • Payout requests to record: {report.payoutEntriesToCreate}</div>
              {report.skippedUnverified.length > 0 && <div className="text-amber-700">Skipped — fare not verified: {report.skippedUnverified.join(", ")}</div>}
              {report.missingPayout.length > 0 && <div className="text-amber-700">No agreed partner payout recorded (no earning credited): {report.missingPayout.join(", ")}</div>}
            </div>
          )}
        </div>
      )}

      {confirm && valid && (
        <ConfirmDialog
          title="Save commission policy?"
          message={
            <div className="space-y-2">
              <p>Commission is taken from the {BASE_LABEL[valid.base]}. Global rate: {valid.global ? `${valid.global.rate}%` : "none"}.</p>
              <p>
                {Object.keys(valid.categories).length} category rule(s), {Object.keys(valid.services).length} service rule(s). The change applies to bookings created from now on and is
                recorded in the audit log.
              </p>
            </div>
          }
          confirmLabel="Save policy"
          busy={busy}
          error={actionError}
          onConfirm={() => void save()}
          onCancel={() => setConfirm(false)}
        />
      )}
      {confirmRebuild && (
        <ConfirmDialog
          title="Apply ledger backfill?"
          message="This records the finance snapshots and ledger entries listed in the check. Partner balances will update accordingly."
          confirmLabel="Apply"
          busy={busy}
          error={actionError}
          onConfirm={() => void runRebuild(false)}
          onCancel={() => setConfirmRebuild(false)}
        />
      )}
    </div>
  );
}

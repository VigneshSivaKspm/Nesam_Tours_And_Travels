import { useEffect, useMemo, useState } from "react";
import { auth } from "../services/firebase";
import {
  StaffActionError,
  approveAdminRequest,
  deleteStaffRole,
  rejectAdminRequest,
  saveStaffRole,
  subscribeAuditLog,
  subscribeLegacyStaff,
  subscribeStaffAccounts,
  subscribeStaffRoles,
  updateAdminAccess,
  validateRole,
  type AuditEntry,
  type LegacyStaffRecord,
  type StaffAccount,
  type StaffRole,
} from "../services/staffService";
import { PERMISSIONS, PERMISSION_INFO, SUPER_ADMIN_ROLE, type Permission } from "../config/permissions";
import { ConfirmDialog, ErrorBanner, Modal, Toast, useToast } from "../components/Feedback";
import { formatDateTime12, formatShortDateTime12, formatHourLabel } from "../utils/time";

type Tab = "accounts" | "requests" | "roles" | "audit";

const errText = (e: unknown) => (e instanceof StaffActionError ? e.message : "Something went wrong. Please try again.");
const pill = (active: boolean) =>
  `px-2 py-0.5 rounded-full text-[11px] font-semibold border ${active ? "text-green-700 bg-green-50 border-green-200" : "text-gray-600 bg-gray-100 border-gray-200"}`;

const AUDIT_LABELS: Record<string, string> = {
  admin_approved: "Approved access request",
  admin_rejected: "Declined access request",
  admin_access_changed: "Changed staff access",
  role_created: "Created role",
  role_updated: "Edited role",
  role_deleted: "Deleted role",
};

export default function StaffRoles() {
  const me = auth.currentUser?.uid || "";
  const [tab, setTab] = useState<Tab>("accounts");
  const [accounts, setAccounts] = useState<StaffAccount[] | null>(null);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [legacy, setLegacy] = useState<LegacyStaffRecord[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const { toast, show: showToast } = useToast();

  useEffect(() => {
    setLoadError(null);
    const unsubs = [
      subscribeStaffAccounts(setAccounts, setLoadError),
      subscribeStaffRoles(setRoles, setLoadError),
      subscribeLegacyStaff(setLegacy, setLoadError),
      subscribeAuditLog(setAudit, setLoadError),
    ];
    return () => unsubs.forEach((u) => u());
  }, [retryKey]);

  const staff = useMemo(() => (accounts ?? []).filter((a) => a.role === "admin"), [accounts]);
  const requests = useMemo(() => (accounts ?? []).filter((a) => a.role === "pending"), [accounts]);
  const openRequests = requests.filter((r) => r.status !== "rejected");
  const holders = (roleId: string) => staff.filter((s) => s.staffRole === roleId).length;
  const roleOptions = [{ id: SUPER_ADMIN_ROLE, name: "Super Admin" }, ...roles];

  // ── Account actions ──────────────────────────────────────────────────────
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ account: StaffAccount; status: "active" | "inactive" } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const run = async (id: string, work: () => Promise<void>, done: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await work();
      showToast(done);
    } catch (e) {
      showToast(errText(e), "error");
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = async () => {
    if (!confirm || busyId) return;
    setBusyId(confirm.account.uid);
    setConfirmError(null);
    try {
      await updateAdminAccess(confirm.account.uid, { status: confirm.status });
      showToast(`${confirm.account.name || confirm.account.email} is now ${confirm.status === "active" ? "active" : "deactivated"}.`);
      setConfirm(null);
    } catch (e) {
      setConfirmError(errText(e));
    } finally {
      setBusyId(null);
    }
  };

  // ── Requests ─────────────────────────────────────────────────────────────
  const [approveRole, setApproveRole] = useState<Record<string, string>>({});
  const [declining, setDeclining] = useState<StaffAccount | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineError, setDeclineError] = useState<string | null>(null);

  const decline = async () => {
    if (!declining || busyId) return;
    if (declineReason.trim().length < 5) {
      setDeclineError("Give a reason of at least 5 characters.");
      return;
    }
    setBusyId(declining.uid);
    setDeclineError(null);
    try {
      await rejectAdminRequest(declining.uid, declineReason);
      showToast(`Request from ${declining.email} declined.`);
      setDeclining(null);
      setDeclineReason("");
    } catch (e) {
      setDeclineError(errText(e));
    } finally {
      setBusyId(null);
    }
  };

  // ── Roles ────────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<{ id: string | null; name: string; permissions: Permission[] } | null>(null);
  const [roleErrors, setRoleErrors] = useState<{ name?: string; permissions?: string; form?: string }>({});
  const [savingRole, setSavingRole] = useState(false);
  const [deletingRole, setDeletingRole] = useState<StaffRole | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const submitRole = async () => {
    if (!editing || savingRole) return;
    const e = validateRole(editing.name, editing.permissions, roles, editing.id);
    setRoleErrors(e);
    if (Object.keys(e).length) return;
    setSavingRole(true);
    try {
      await saveStaffRole(editing.name, editing.permissions, editing.id);
      showToast(editing.id ? `Role "${editing.name.trim()}" updated for every account holding it.` : `Role "${editing.name.trim()}" created.`);
      setEditing(null);
    } catch (err) {
      setRoleErrors({ form: errText(err) });
    } finally {
      setSavingRole(false);
    }
  };

  const removeRole = async () => {
    if (!deletingRole || busyId) return;
    setBusyId(deletingRole.id);
    setDeleteError(null);
    try {
      await deleteStaffRole(deletingRole.id);
      showToast(`Role "${deletingRole.name}" deleted.`);
      setDeletingRole(null);
    } catch (e) {
      setDeleteError(errText(e));
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "accounts", label: "Staff accounts", count: staff.length },
    { id: "requests", label: "Access requests", count: openRequests.length },
    { id: "roles", label: "Roles", count: roles.length },
    { id: "audit", label: "Audit log" },
  ];
  const selectCls = "px-2 py-1.5 border border-[#E5E5E5] rounded-lg text-[12px] bg-white disabled:opacity-50";

  return (
    <div className="p-6 space-y-5">
      <Toast toast={toast} />
      {loadError && <ErrorBanner message={loadError} onRetry={() => setRetryKey((k) => k + 1)} />}

      <div>
        <h1 className="text-lg font-bold text-[#111]">Staff &amp; Roles</h1>
        <p className="text-[12px] text-[#666]">
          Staff sign up from the admin login page; a super admin approves each request with a role. Roles decide which areas a
          staff member can open and change — enforced by the database rules, not only by this panel.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${tab === t.id ? "bg-[#111] text-white border-[#111]" : "bg-white text-[#444] border-[#E5E5E5]"}`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 opacity-70">{t.count}</span>}
          </button>
        ))}
      </div>

      {accounts === null && !loadError && <div className="text-[12px] text-[#999]">Loading staff…</div>}

      {accounts !== null && tab === "accounts" && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-x-auto">
          <table className="w-full min-w-[760px] text-[12px]">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5] text-[11px] text-[#999] uppercase">
                {["Name", "Email", "Role", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#999]">No staff accounts yet.</td>
                </tr>
              )}
              {staff.map((s) => {
                const self = s.uid === me;
                const draft = roleDraft[s.uid] ?? s.staffRole;
                const active = s.status === "active";
                return (
                  <tr key={s.uid} className="border-b border-[#F5F5F5] last:border-0">
                    <td className="px-4 py-3 font-semibold text-[#111]">
                      {s.name || "—"} {self && <span className="text-[10px] font-normal text-[#999]">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-[#666]">{s.email || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={draft}
                          disabled={self || busyId !== null}
                          onChange={(e) => setRoleDraft((d) => ({ ...d, [s.uid]: e.target.value }))}
                          className={selectCls}
                        >
                          {!roleOptions.some((r) => r.id === s.staffRole) && <option value={s.staffRole}>{s.roleName} (deleted)</option>}
                          {roleOptions.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                        {draft !== s.staffRole && (
                          <button
                            disabled={busyId !== null}
                            onClick={() =>
                              void run(s.uid, () => updateAdminAccess(s.uid, { staffRole: draft }), `${s.name || s.email} now has the ${roleOptions.find((r) => r.id === draft)?.name} role.`)
                            }
                            className="text-[11px] font-semibold text-[#E21B23] disabled:opacity-50"
                          >
                            Save
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={pill(active)}>{active ? "Active" : "Deactivated"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!self && (
                        <button
                          disabled={busyId !== null}
                          onClick={() => {
                            setConfirmError(null);
                            setConfirm({ account: s, status: active ? "inactive" : "active" });
                          }}
                          className={`text-[11px] font-semibold disabled:opacity-50 ${active ? "text-[#E21B23]" : "text-green-700"}`}
                        >
                          {active ? "Deactivate" : "Reactivate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {legacy.length > 0 && (
            <div className="border-t border-[#E5E5E5] p-4 space-y-2">
              <div className="text-[12px] font-bold text-[#111]">Legacy staff records ({legacy.length})</div>
              <p className="text-[11px] text-[#666]">
                Created by the previous Staff screen. They are not linked to any sign-in account and grant no access. Ask these people
                to sign up from the admin login page, then approve their requests with a role.
              </p>
              <ul className="text-[11px] text-[#444] space-y-0.5">
                {legacy.map((l) => (
                  <li key={l.id}>
                    {l.name || "—"} · {l.email || "no email"} · recorded role: {l.role || "—"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {accounts !== null && tab === "requests" && (
        <div className="space-y-3">
          {requests.length === 0 && (
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-[12px] text-[#999]">No access requests.</div>
          )}
          {requests.map((r) => {
            const declined = r.status === "rejected";
            const chosen = approveRole[r.uid] || "";
            return (
              <div key={r.uid} className="bg-white rounded-xl border border-[#E5E5E5] p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="text-[13px] font-semibold text-[#111]">{r.name || "—"}</div>
                  <div className="text-[11px] text-[#666]">
                    {r.email} {r.createdAt && `· requested ${formatDateTime12(r.createdAt)}`}
                  </div>
                  {declined && <div className="text-[11px] text-[#E21B23] mt-1">Declined: {r.rejectionReason || "no reason recorded"}</div>}
                </div>
                <select value={chosen} onChange={(e) => setApproveRole((d) => ({ ...d, [r.uid]: e.target.value }))} className={selectCls}>
                  <option value="">Choose a role…</option>
                  {roleOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <button
                  disabled={!chosen || busyId !== null}
                  onClick={() => void run(r.uid, () => approveAdminRequest(r.uid, chosen), `${r.email} approved.`)}
                  className="px-3 py-1.5 bg-[#E21B23] text-white rounded-lg text-[12px] font-semibold disabled:opacity-50"
                >
                  Approve
                </button>
                {!declined && (
                  <button
                    disabled={busyId !== null}
                    onClick={() => {
                      setDeclineError(null);
                      setDeclineReason("");
                      setDeclining(r);
                    }}
                    className="px-3 py-1.5 border border-[#E5E5E5] rounded-lg text-[12px] font-semibold text-[#444] disabled:opacity-50"
                  >
                    Decline
                  </button>
                )}
              </div>
            );
          })}
          {roles.length === 0 && openRequests.length > 0 && (
            <p className="text-[11px] text-[#666]">Tip: create roles first (Roles tab) to give staff less than full access.</p>
          )}
        </div>
      )}

      {accounts !== null && tab === "roles" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setRoleErrors({});
                setEditing({ id: null, name: "", permissions: [] });
              }}
              className="px-3 py-1.5 bg-[#E21B23] text-white rounded-lg text-[12px] font-semibold"
            >
              New role
            </button>
          </div>
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
            <div className="text-[13px] font-semibold text-[#111]">Super Admin <span className="text-[10px] font-normal text-[#999]">built-in</span></div>
            <div className="text-[11px] text-[#666]">Every area, plus staff accounts and roles. {holders(SUPER_ADMIN_ROLE)} account(s).</div>
          </div>
          {roles.length === 0 && (
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-[12px] text-[#999]">
              No custom roles yet. Create one to give staff access to only the areas they need.
            </div>
          )}
          {roles.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-[#E5E5E5] p-4 flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-[220px]">
                <div className="text-[13px] font-semibold text-[#111]">{r.name}</div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {r.permissions.map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded-md bg-[#F5F5F5] text-[10px] font-semibold text-[#444]">{PERMISSION_INFO[p].label}</span>
                  ))}
                </div>
                <div className="text-[11px] text-[#999] mt-1.5">{holders(r.id)} account(s)</div>
              </div>
              <button
                onClick={() => {
                  setRoleErrors({});
                  setEditing({ id: r.id, name: r.name, permissions: r.permissions });
                }}
                className="text-[11px] font-semibold text-[#111]"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  setDeleteError(null);
                  setDeletingRole(r);
                }}
                className="text-[11px] font-semibold text-[#E21B23]"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {accounts !== null && tab === "audit" && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] divide-y divide-[#F5F5F5]">
          {audit.length === 0 && <div className="p-8 text-center text-[12px] text-[#999]">No staff changes recorded yet.</div>}
          {audit.map((a) => (
            <div key={a.id} className="px-4 py-3 text-[12px]">
              <div className="font-semibold text-[#111]">{AUDIT_LABELS[a.action] || a.action}</div>
              <div className="text-[11px] text-[#666]">
                by {a.actorName || "—"} {a.at && `· ${formatDateTime12(a.at)}`}
                {typeof a.details.email === "string" && a.details.email ? ` · ${a.details.email}` : ""}
                {typeof a.details.name === "string" && a.details.name ? ` · ${a.details.name}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal
          title={editing.id ? "Edit role" : "New role"}
          subtitle="Choose the areas this role can open and change."
          onClose={() => setEditing(null)}
          busy={savingRole}
          footer={
            <>
              <button onClick={() => setEditing(null)} disabled={savingRole} className="px-4 py-2 border border-[#E5E5E5] rounded-lg text-xs font-semibold text-[#666] disabled:opacity-50">
                Cancel
              </button>
              <button onClick={() => void submitRole()} disabled={savingRole} className="px-4 py-2 bg-[#E21B23] text-white rounded-lg text-xs font-semibold disabled:opacity-60">
                {savingRole ? "Saving…" : "Save role"}
              </button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            {roleErrors.form && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">{roleErrors.form}</div>}
            <label className="block">
              <span className="block text-[11px] font-semibold text-[#666] mb-1">Role name *</span>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                maxLength={40}
                className="w-full p-2 border border-[#E5E5E5] rounded-lg text-xs"
              />
              {roleErrors.name && <p className="text-[10px] text-red-600 mt-1">{roleErrors.name}</p>}
            </label>
            <div className="space-y-1.5">
              <span className="block text-[11px] font-semibold text-[#666]">Areas *</span>
              {PERMISSIONS.map((p) => (
                <label key={p} className="flex items-start gap-2 p-2 rounded-lg border border-[#F0F0F0] cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[#E21B23]"
                    checked={editing.permissions.includes(p)}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        permissions: e.target.checked ? [...editing.permissions, p] : editing.permissions.filter((x) => x !== p),
                      })
                    }
                  />
                  <span>
                    <span className="font-semibold text-[#111]">{PERMISSION_INFO[p].label}</span>
                    <span className="block text-[11px] text-[#666]">{PERMISSION_INFO[p].description}</span>
                  </span>
                </label>
              ))}
              {roleErrors.permissions && <p className="text-[10px] text-red-600">{roleErrors.permissions}</p>}
            </div>
            {editing.id && <p className="text-[11px] text-[#666]">Saving updates the access of all {holders(editing.id)} account(s) with this role immediately.</p>}
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.status === "active" ? "Reactivate staff account" : "Deactivate staff account"}
          message={
            confirm.status === "active"
              ? `${confirm.account.name || confirm.account.email} will regain the access of the ${confirm.account.roleName} role.`
              : `${confirm.account.name || confirm.account.email} will immediately lose all admin access.`
          }
          confirmLabel={confirm.status === "active" ? "Reactivate" : "Deactivate"}
          danger={confirm.status === "inactive"}
          busy={busyId !== null}
          error={confirmError}
          onConfirm={() => void changeStatus()}
          onCancel={() => setConfirm(null)}
        />
      )}

      {declining && (
        <Modal
          title="Decline access request"
          subtitle={declining.email}
          onClose={() => setDeclining(null)}
          busy={busyId !== null}
          footer={
            <>
              <button onClick={() => setDeclining(null)} disabled={busyId !== null} className="px-4 py-2 border border-[#E5E5E5] rounded-lg text-xs font-semibold text-[#666] disabled:opacity-50">
                Cancel
              </button>
              <button onClick={() => void decline()} disabled={busyId !== null} className="px-4 py-2 bg-[#E21B23] text-white rounded-lg text-xs font-semibold disabled:opacity-60">
                Decline
              </button>
            </>
          }
        >
          <label className="block text-xs">
            <span className="block text-[11px] font-semibold text-[#666] mb-1">Reason (shown to the requester) *</span>
            <input value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} maxLength={300} className="w-full p-2 border border-[#E5E5E5] rounded-lg text-xs" />
            {declineError && <p className="text-[10px] text-red-600 mt-1">{declineError}</p>}
          </label>
        </Modal>
      )}

      {deletingRole && (
        <ConfirmDialog
          title="Delete role"
          message={`Delete the role "${deletingRole.name}"? Roles still assigned to accounts cannot be deleted.`}
          confirmLabel="Delete"
          danger
          busy={busyId !== null}
          error={deleteError}
          onConfirm={() => void removeRole()}
          onCancel={() => setDeletingRole(null)}
        />
      )}
    </div>
  );
}

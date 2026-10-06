import { useEffect, useState } from "react";
import { subscribeToCollection } from "../services/adminFirestoreService";
import { publishLegalDocument, seedLegalDocuments } from "../services/bookingOpsService";
import { ActionError } from "../services/callables";
import { ErrorBanner, Modal, Toast, useToast } from "../components/Feedback";
import { Field, Notice, inputCls, primaryBtn, secondaryBtn } from "../components/FormKit";
import { useAccess, useCan } from "../components/AccessContext";
import { formatDateTime12, toDate } from "../utils/time";

interface LegalDoc {
  id: string; key: string; type: string; role: string; title: string; body: string; checkboxText: string; requiresAcceptance: boolean;
  version: number; status: "Draft" | "Published"; changeSummary?: string; publishedAt?: unknown; publishedByName?: string;
}

const ROLE_LABEL: Record<string, string> = { customer: "Customers", driver: "Drivers", vendor: "Vendors", admin: "Staff" };
const TYPE_LABEL: Record<string, string> = {
  terms: "Terms & Conditions", privacy: "Privacy Policy", driver_terms: "Driver Terms", vendor_terms: "Vendor Terms", cancellation: "Cancellation Policy",
  refund: "Refund Policy", payment: "Payment Terms", vehicle_verification_consent: "Vehicle photo consent", location_consent: "Location permission",
};

/** Terms, privacy and consent documents per role. Publishing a new version asks everyone to accept again. */
export default function LegalDocuments() {
  const canEdit = useCan("system");
  const access = useAccess();
  const [docs, setDocs] = useState<LegalDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState<LegalDoc | null>(null);
  const [seeding, setSeeding] = useState(false);
  const { toast, show } = useToast(7000);

  useEffect(() => {
    setDocs(null);
    setError(null);
    return subscribeToCollection<LegalDoc>("legal_documents", (d) => setDocs(d), (m) => { setError(m); setDocs([]); });
  }, [retry]);

  const seed = async () => {
    setSeeding(true);
    try {
      const r = await seedLegalDocuments();
      show(r.created ? `${r.created} starter templates created as drafts. Review and edit them, then publish.` : "All starter templates already exist.");
    } catch (e) {
      show(e instanceof ActionError ? e.message : "Could not create the templates.", "error");
    } finally {
      setSeeding(false);
    }
  };

  const grouped = (["customer", "driver", "vendor", "admin"] as const).map((role) => ({ role, items: (docs ?? []).filter((d) => d.role === role).sort((a, b) => a.title.localeCompare(b.title)) }));

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Toast toast={toast} />
      {error && <ErrorBanner message={error} onRetry={() => setRetry((n) => n + 1)} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111]">Terms, Privacy & Consent</h1>
          <p className="text-sm text-[#555]">Role-specific documents. Users must accept the published version before they continue; a new version asks them again. Each acceptance records the user, version, time and device.</p>
        </div>
        {access.isSuper && <button onClick={seed} disabled={seeding} className={secondaryBtn}>{seeding ? "Creating…" : "Create starter templates"}</button>}
      </div>
      <Notice tone="warn">The starter text is a template, not legal advice. Have your legal adviser review and edit every document for how NESAM actually operates before publishing. Drafts are not shown to users or enforced.</Notice>

      {docs === null && !error && <p className="text-sm text-[#555]" role="status">Loading documents…</p>}
      {docs !== null && docs.length === 0 && !error && <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-sm text-[#555]">No documents yet.{access.isSuper ? " Create the starter templates to begin." : " A super admin can create the starter templates."}</div>}

      {grouped.filter((g) => g.items.length).map((g) => (
        <section key={g.role} className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-bold text-[#111] bg-[#FAFAFA] border-b border-[#E5E5E5]">{ROLE_LABEL[g.role]}</h2>
          <ul className="divide-y divide-[#F0F0F0]">
            {g.items.map((d) => (
              <li key={d.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#111]">{d.title}</div>
                  <div className="text-xs text-[#555]">{TYPE_LABEL[d.type] ?? d.type}{d.requiresAcceptance ? " · acceptance required" : " · information only"}</div>
                  <div className="text-xs text-[#555]">{d.status === "Published" ? `Published v${d.version} · ${formatDateTime12(toDate(d.publishedAt as never))}${d.publishedByName ? ` · ${d.publishedByName}` : ""}` : "Draft — not yet published"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${d.status === "Published" ? "bg-green-50 text-green-800 border-green-300" : "bg-amber-50 text-amber-900 border-amber-300"}`}>{d.status}</span>
                  <button onClick={() => setEditing(d)} className={secondaryBtn}>{canEdit ? "Edit / publish" : "View"}</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {editing && <Editor doc={editing} canEdit={canEdit} onClose={() => setEditing(null)} onDone={(t) => { setEditing(null); show(t); }} />}
    </div>
  );
}

function Editor({ doc, canEdit, onClose, onDone }: { doc: LegalDoc; canEdit: boolean; onClose: () => void; onDone: (t: string) => void }) {
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const [checkbox, setCheckbox] = useState(doc.checkboxText);
  const [required, setRequired] = useState(doc.requiresAcceptance);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = title !== doc.title || body !== doc.body || checkbox !== doc.checkboxText || required !== doc.requiresAcceptance;

  const publish = async () => {
    if (title.trim().length < 3) return setError("Enter a title.");
    if (body.trim().length < 40) return setError("The text is too short.");
    if (checkbox.trim().length < 10) return setError("Enter the text shown next to the checkbox.");
    if (doc.status === "Published" && summary.trim().length < 5) return setError("Say briefly what changed — users will see that they must accept a new version.");
    setBusy(true);
    setError(null);
    try {
      const r = await publishLegalDocument({ type: doc.type, role: doc.role, title: title.trim(), body, checkboxText: checkbox.trim(), requiresAcceptance: required, changeSummary: summary.trim() });
      onDone(`Published version ${r.version}. ${required ? "Users are asked to accept it." : ""}`);
    } catch (e) {
      setError(e instanceof ActionError ? e.message : "Could not publish.");
      setBusy(false);
    }
  };

  return (
    <Modal title={doc.title} subtitle={`${ROLE_LABEL[doc.role]} · ${doc.status === "Published" ? `version ${doc.version}` : "draft"}`} onClose={onClose} busy={busy} size="xl"
      footer={<><button onClick={onClose} disabled={busy} className={secondaryBtn}>Close</button>{canEdit && <button onClick={publish} disabled={busy || (doc.status === "Published" && !changed)} className={primaryBtn}>{busy ? "Publishing…" : doc.status === "Published" ? "Publish new version" : "Publish"}</button>}</>}>
      <div className="space-y-3">
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} maxLength={140} className={inputCls} /></Field>
        <Field label="Text" hint="Plain text. Blank lines separate paragraphs."><textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={!canEdit} rows={16} className={`${inputCls} font-mono`} /></Field>
        <Field label="Checkbox text" hint="Exactly what the user ticks. Keep it honest: it should say only that they have read / agree to this document."><input value={checkbox} onChange={(e) => setCheckbox(e.target.value)} disabled={!canEdit} maxLength={300} className={inputCls} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold text-[#333]"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} disabled={!canEdit} className="w-4 h-4 accent-[#E21B23]" />Users must accept this before continuing</label>
        {canEdit && doc.status === "Published" && <Field label="What changed" required><input value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} className={inputCls} /></Field>}
      </div>
    </Modal>
  );
}

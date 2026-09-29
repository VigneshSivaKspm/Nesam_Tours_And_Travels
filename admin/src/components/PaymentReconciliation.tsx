import { useState } from 'react';
import { reconcilePayment } from '../services/paymentReconciliation';
import { db, auth } from '../services/firebase';

export default function PaymentReconciliation({ bookingId }: { bookingId: string }) {
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [tolls, setTolls] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const reconcile = async () => {
    if (busy) return;
    if (!reference.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return setMessage('Enter the received amount and bank/UPI reference.');
    setBusy(true); setMessage('');
    try {
      await reconcilePayment(db, bookingId, amount, reference, tolls, auth.currentUser?.uid || '');
      setMessage('Payment reconciled. Eligible partner balance will update.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not reconcile payment.'); }
    finally { setBusy(false); }
  };
  return <section className="bg-white border rounded-xl p-5 space-y-3">
    <h3 className="font-bold text-sm">Verify received payment</h3>
    <p className="text-xs text-gray-600">Use only after confirming the money reached the company account. This records a received payment; it does not charge the customer.</p>
    <label className="block text-xs">Received amount (₹)<input className="block border rounded p-2 w-full" type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} /></label>
    <label className="block text-xs">Bank / UPI reference<input className="block border rounded p-2 w-full" value={reference} onChange={e => setReference(e.target.value)} /></label>
    <label className="flex gap-2 text-xs"><input type="checkbox" checked={tolls} onChange={e => setTolls(e.target.checked)} />I reviewed and approve the recorded toll receipts</label>
    <button disabled={busy} onClick={() => void reconcile()} className="bg-red-600 text-white px-3 py-2 rounded text-sm disabled:opacity-50">Record verified payment</button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}

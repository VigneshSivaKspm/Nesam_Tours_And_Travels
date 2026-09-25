import React, { useState } from 'react';
import type { BankDetails, PayoutRequest, TripDetails } from '../types';
import { ArrowUpRight, Clock, History, Loader2 } from 'lucide-react';
import { describeFirestoreError } from '../services/driverFirestoreService';

interface WalletPayoutScreenProps {
  availableBalance: number;
  pendingPayouts: number;
  totalPaidOut: number;
  bank: BankDetails;
  payoutRequests: PayoutRequest[];
  completedTrips: TripDetails[];
  onRequestPayout: (amount: number, method: 'UPI' | 'Bank Transfer', details: string) => Promise<void>;
}

const MIN_PAYOUT = 100;
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const statusCls = (s: string) =>
  s === 'Paid' ? 'text-emerald-700 bg-emerald-100' : s === 'Pending' ? 'text-amber-700 bg-amber-100' : 'text-gray-600 bg-gray-200';

export const WalletPayoutScreen: React.FC<WalletPayoutScreenProps> = ({
  availableBalance,
  pendingPayouts,
  totalPaidOut,
  bank,
  payoutRequests,
  completedTrips,
  onRequestPayout,
}) => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'UPI' | 'Bank Transfer'>(bank.upiId ? 'UPI' : 'Bank Transfer');
  const [upiId, setUpiId] = useState(bank.upiId);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openModal = () => {
    setAmount(String(availableBalance));
    setError('');
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Math.floor(Number(amount));
    if (!(value >= MIN_PAYOUT)) return setError(`Minimum payout is ${inr(MIN_PAYOUT)}.`);
    if (value > availableBalance) return setError('Amount exceeds your available balance.');
    if (method === 'UPI' && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upiId.trim())) return setError('Enter a valid UPI ID.');
    if (method === 'Bank Transfer' && !bank.accountNumber) return setError('No bank account on file. Add one from your profile.');

    const details =
      method === 'UPI' ? upiId.trim() : `${bank.accountHolder} • A/c ${bank.accountNumber} • ${bank.ifsc}`;
    setSubmitting(true);
    setError('');
    try {
      await onRequestPayout(value, method, details);
      setOpen(false);
    } catch (err) {
      setError(describeFirestoreError(err, 'Could not submit the payout request.'));
    } finally {
      setSubmitting(false);
    }
  };

  const recentCredits = completedTrips.slice(0, 20);

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#E21E26]">Driver Wallet</span>
            <p className="text-xs text-gray-500 mt-0.5">Available to withdraw</p>
            <div className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">{inr(availableBalance)}</div>
            <p className="text-xs text-gray-500 mt-1">
              {inr(pendingPayouts)} in pending requests • {inr(totalPaidOut)} paid out
            </p>
          </div>
          <button
            onClick={openModal}
            disabled={availableBalance < MIN_PAYOUT}
            className="px-6 py-3 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-black rounded-xl shadow-sm flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowUpRight className="w-4 h-4" /> Request Payout
          </button>
        </div>
        {availableBalance < MIN_PAYOUT && (
          <p className="text-[11px] text-gray-500 mt-3">You can request a payout once your balance reaches {inr(MIN_PAYOUT)}.</p>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-gray-900">Request Payout</h2>
              <span className="text-xs text-gray-500 font-mono">Available: {inr(availableBalance)}</span>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-mono font-bold text-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['UPI', 'Bank Transfer'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`py-2 rounded-lg text-xs font-bold border ${method === m ? 'bg-[#E21E26] text-white border-[#E21E26]' : 'bg-gray-50 text-gray-700'}`}
                  >
                    {m === 'UPI' ? 'UPI' : 'Bank (NEFT/IMPS)'}
                  </button>
                ))}
              </div>
              {method === 'UPI' ? (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">UPI ID</label>
                  <input value={upiId} onChange={(e) => setUpiId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" placeholder="name@okaxis" />
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-1 font-mono text-gray-700">
                  <p className="font-sans font-bold">{bank.accountHolder || 'No account on file'}</p>
                  {bank.accountNumber && <p>A/c ••••{bank.accountNumber.slice(-4)} • {bank.ifsc}</p>}
                  {bank.bankName && <p>{bank.bankName}</p>}
                </div>
              )}
              {error && <p className="text-[11px] text-red-600 font-semibold">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 border text-xs font-bold text-gray-700 rounded-xl">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-[#E21E26] text-white text-xs font-bold rounded-xl shadow flex items-center gap-2 disabled:opacity-60">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#E21E26]" /> Payout Requests
        </h2>
        {payoutRequests.length === 0 ? (
          <p className="text-xs text-gray-400">No payout requests yet.</p>
        ) : (
          <div className="space-y-3">
            {payoutRequests.map((po) => (
              <div key={po.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900">{po.method}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 truncate">{po.details} • {po.requestedAt}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-gray-900">{inr(po.amount)}</span>
                  <span className={`block text-[10px] font-bold px-2 py-0.5 rounded mt-0.5 ${statusCls(po.status)}`}>{po.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <History className="w-5 h-5 text-[#E21E26]" /> Trip Credits
        </h2>
        {recentCredits.length === 0 ? (
          <p className="text-xs text-gray-400">Earnings from completed trips appear here.</p>
        ) : (
          <div>
            {recentCredits.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5 border-b last:border-0 text-xs gap-3">
                <div className="min-w-0">
                  <span className="font-bold text-gray-900">Trip {t.bookingId}</span>
                  <p className="text-[10px] text-gray-400 mt-0.5">{t.completedAt?.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <div className="font-mono font-extrabold text-sm text-emerald-600 shrink-0">+ {inr(t.driverEarnings + t.tollCharges)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

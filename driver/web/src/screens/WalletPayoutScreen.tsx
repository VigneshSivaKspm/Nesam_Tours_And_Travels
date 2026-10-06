import React, { useState } from 'react';
import { formatDateTime12 } from '../utils/time';
import type { BankDetails, DriverWallet, LedgerEntry, PayoutRequest } from '../types';
import { ArrowUpRight, Clock, History, Loader2 } from 'lucide-react';
import { describeFirestoreError } from '../services/driverFirestoreService';

interface WalletPayoutScreenProps {
  wallet: DriverWallet;
  bank: BankDetails;
  payoutRequests: PayoutRequest[];
  ledger: LedgerEntry[];
  /** Fleet drivers are paid by their vendor, not from a NESAM wallet. */
  fleetDriver: boolean;
  onRequestPayout: (amount: number, method: 'UPI' | 'Bank Transfer') => Promise<void>;
}

const inr = (n: number) => `${n < 0 ? '−' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;
const when = (d: Date | null) => (d ? formatDateTime12(d) : '—');

const statusCls = (s: string) =>
  s === 'Paid' ? 'text-emerald-700 bg-emerald-100' : s === 'Pending' || s === 'Deferred' ? 'text-amber-700 bg-amber-100' : 'text-gray-600 bg-gray-200';

const ENTRY_LABEL: Record<string, string> = {
  trip_earning: 'Trip earning',
  toll_reimbursement: 'Toll reimbursement',
  cash_collected: 'Cash fare you collected',
  payout: 'Payout',
};
const ENTRY_STATUS: Record<string, string> = {
  pending: 'Awaiting customer payment',
  available: 'Available',
  reserved: 'Held for payout',
  completed: 'Completed',
  cancelled: 'Released',
};

export const WalletPayoutScreen: React.FC<WalletPayoutScreenProps> = ({
  wallet,
  bank,
  payoutRequests,
  ledger,
  fleetDriver,
  onRequestPayout,
}) => {
  const withdrawable = Math.max(0, Math.floor(wallet.available));
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'UPI' | 'Bank Transfer'>(bank.accountNumber || !bank.upiId ? 'Bank Transfer' : 'UPI');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openModal = () => {
    setAmount(withdrawable > 0 ? String(withdrawable) : '');
    setError('');
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value <= 0) return setError('Enter the amount in whole rupees.');
    if (value > withdrawable) return setError(`You can withdraw up to ${inr(withdrawable)}.`);
    if (method === 'UPI' && !bank.upiId) return setError('No UPI ID in your profile. Add one from Profile first.');
    if (method === 'Bank Transfer' && !bank.accountNumber) return setError('No bank account in your profile. Add one from Profile first.');
    setSubmitting(true);
    setError('');
    try {
      await onRequestPayout(value, method);
      setOpen(false);
    } catch (err) {
      setError(describeFirestoreError(err, 'Could not submit the payout request.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (fleetDriver && ledger.length === 0 && payoutRequests.length === 0) {
    return (
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-2">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#E21E26]">Driver Wallet</span>
        <h1 className="text-lg font-extrabold text-gray-900">Settled by your fleet</h1>
        <p className="text-xs text-gray-500">
          You drive for a fleet operator. They receive the payout for your trips and pay you directly, so NESAM does not keep a wallet balance for you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#E21E26]">Driver Wallet</span>
            <p className="text-xs text-gray-500 mt-0.5">Available to withdraw — kept by NESAM from your trip ledger</p>
            <div className={`text-3xl sm:text-4xl font-black mt-2 ${wallet.available < 0 ? 'text-red-600' : 'text-gray-900'}`}>{inr(wallet.available)}</div>
            {wallet.available < 0 && (
              <p className="text-xs text-red-600 mt-1">Cash fares you collected exceed your earnings; upcoming earnings settle this first.</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {inr(wallet.pending)} awaiting customer payment • {inr(wallet.reserved)} held for requests • {inr(wallet.paidOut)} paid out
            </p>
          </div>
          <button
            onClick={openModal}
            disabled={withdrawable <= 0}
            className="px-6 py-3 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-black rounded-xl shadow-sm flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowUpRight className="w-4 h-4" /> Request Payout
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-gray-900">Request Payout</h2>
              <span className="text-xs text-gray-500 font-mono">Available: {inr(withdrawable)}</span>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  max={withdrawable}
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setError(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-mono font-bold text-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['Bank Transfer', 'UPI'] as const).map((m) => (
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
              <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-1 font-mono text-gray-700">
                <p className="font-sans text-[11px] text-gray-500">Paid to the account saved in your profile:</p>
                {method === 'UPI' ? (
                  <p className="font-bold">{bank.upiId || 'No UPI ID saved'}</p>
                ) : bank.accountNumber ? (
                  <>
                    <p className="font-sans font-bold">{bank.accountHolder}</p>
                    <p>A/c ••••{bank.accountNumber.slice(-4)} • {bank.ifsc}</p>
                    {bank.bankName && <p>{bank.bankName}</p>}
                  </>
                ) : (
                  <p className="font-bold">No bank account saved</p>
                )}
              </div>
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
                  <p className="text-[11px] text-gray-500 mt-0.5 truncate">{po.details || '—'} • {po.requestedAt}</p>
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
          <History className="w-5 h-5 text-[#E21E26]" /> Wallet Ledger
        </h2>
        {ledger.length === 0 ? (
          <p className="text-xs text-gray-400">Earnings are recorded here when a completed trip’s fare is verified.</p>
        ) : (
          <div>
            {ledger.slice(0, 50).map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2.5 border-b last:border-0 text-xs gap-3">
                <div className="min-w-0">
                  <span className="font-bold text-gray-900">
                    {ENTRY_LABEL[e.type] || e.type}
                    {e.bookingCode && <span className="font-mono font-normal text-gray-500"> · {e.bookingCode}</span>}
                  </span>
                  <p className="text-[10px] text-gray-400 mt-0.5">{when(e.createdAt)} • {ENTRY_STATUS[e.status] || e.status}</p>
                </div>
                <div className={`font-mono font-extrabold text-sm shrink-0 ${e.status === 'cancelled' ? 'text-gray-400 line-through' : e.direction === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {e.direction === 'credit' ? '+' : '−'} {inr(e.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

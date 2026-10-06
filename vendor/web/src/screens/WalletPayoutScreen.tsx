import React, { useState } from 'react';
import { formatDateTime12 } from '../utils/time';
import { WalletDetails, PayoutRequest, TransactionRecord, VendorProfile } from '../types';
import { ArrowUpRight, Clock, CheckCircle, History } from 'lucide-react';

interface WalletPayoutScreenProps {
  profile: VendorProfile;
  wallet: WalletDetails;
  payoutRequests: PayoutRequest[];
  transactions: TransactionRecord[];
  onRequestPayout: (amount: number, method: 'UPI' | 'Bank Transfer') => Promise<void>;
}

const rupees = (n: number) => `${n < 0 ? '−' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;
const when = (d: Date | null) => (d ? formatDateTime12(d) : '—');

const ENTRY_LABEL: Record<string, string> = {
  trip_earning: 'Trip earning',
  toll_reimbursement: 'Toll reimbursement',
  cash_collected: 'Cash fare collected by your driver',
  payout: 'Payout',
};
const ENTRY_STATUS: Record<string, string> = {
  pending: 'Awaiting customer payment',
  available: 'Available',
  reserved: 'Held for payout',
  completed: 'Completed',
  cancelled: 'Released',
};
const payoutStyle: Record<string, string> = {
  Paid: 'text-emerald-700 bg-emerald-100',
  Pending: 'text-amber-800 bg-amber-100',
  Deferred: 'text-amber-800 bg-amber-100',
  Rejected: 'text-red-700 bg-red-100',
  Cancelled: 'text-gray-600 bg-gray-100',
};

export const WalletPayoutScreen: React.FC<WalletPayoutScreenProps> = ({
  profile,
  wallet,
  payoutRequests,
  transactions,
  onRequestPayout
}) => {
  const withdrawable = Math.max(0, Math.floor(wallet.available));
  const hasBank = !!profile.bankAccountNumber && !!profile.ifscCode;
  const hasUpi = !!profile.upiId;
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [payoutMethod, setPayoutMethod] = useState<'UPI' | 'Bank Transfer'>(hasBank || !hasUpi ? 'Bank Transfer' : 'UPI');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openModal = () => {
    setPayoutAmount(withdrawable > 0 ? String(withdrawable) : '');
    setError('');
    setShowPayoutModal(true);
  };

  const handleSubmitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const amount = Number(payoutAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0) return setError('Enter the amount in whole rupees.');
    if (amount > withdrawable) return setError(`You can withdraw up to ${rupees(withdrawable)}.`);
    setSubmitting(true);
    setError('');
    try {
      await onRequestPayout(amount, payoutMethod);
      setShowPayoutModal(false);
      setNotice(`Payout request for ${rupees(amount)} sent to NESAM Finance. The amount is held until they transfer it.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payout request failed. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const destination =
    payoutMethod === 'UPI'
      ? hasUpi ? `UPI ${profile.upiId}` : 'No UPI ID saved'
      : hasBank ? `${profile.bankAccountName ? `${profile.bankAccountName} · ` : ''}Account ${profile.bankAccountNumber} · ${profile.ifscCode}` : 'No bank account saved';

  return (
    <div className="space-y-6 pb-20">

      {/* Wallet Balance Banner */}
      <div className="bg-[#111111] text-white p-6 rounded-2xl border border-[#262626] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#E21E26]">
              NESAM VENDOR FLEET WALLET
            </span>
            <p className="text-xs text-gray-400 mt-0.5">Available to withdraw — kept by NESAM from your trip ledger</p>
            <div className={`text-4xl font-black mt-2 ${wallet.available < 0 ? 'text-red-400' : 'text-white'}`}>
              {rupees(wallet.available)}
            </div>
            {wallet.available < 0 && (
              <p className="text-xs text-red-300 mt-1 font-medium">Cash fares your drivers collected exceed your earnings; upcoming earnings settle this first.</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-2">
              <span className="text-amber-400">{rupees(wallet.pending)} awaiting customer payment</span>
              <span className="text-gray-300">{rupees(wallet.reserved)} held for payout requests</span>
              <span className="text-gray-300">{rupees(wallet.paidOut)} paid out</span>
            </div>
          </div>

          <button
            onClick={openModal}
            disabled={withdrawable <= 0}
            title={withdrawable <= 0 ? 'Nothing is available to withdraw yet.' : undefined}
            className="px-6 py-3 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-black rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowUpRight className="w-4 h-4" /> Request Fleet Payout
          </button>
        </div>
      </div>

      {notice && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-gray-900">Request Payout</h2>
              <span className="text-xs text-gray-500 font-mono">Available: {rupees(withdrawable)}</span>
            </div>
            {error && <div role="alert" className="text-xs text-red-600 font-semibold">{error}</div>}

            <form onSubmit={handleSubmitPayout} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  max={withdrawable}
                  value={payoutAmount}
                  onChange={e => { setPayoutAmount(e.target.value); setError(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-mono font-bold text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Payout Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Bank Transfer', 'UPI'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayoutMethod(m)}
                      className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                        payoutMethod === m ? 'bg-[#E21E26] text-white border-[#E21E26]' : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      {m === 'Bank Transfer' ? 'Bank NEFT / IMPS' : 'UPI'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-700 block mb-1">Paid to your saved payout account</span>
                <p className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-xs font-mono font-bold text-gray-800">{destination}</p>
                <p className="text-[11px] text-gray-500 mt-1">To change it, update your payout details with NESAM (Company Verification & KYC).</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowPayoutModal(false)} disabled={submitting} className="px-4 py-2 border text-xs font-bold text-gray-700 rounded-xl">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow disabled:opacity-50">
                  {submitting ? 'Sending…' : 'Confirm Payout Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payout Requests History */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#E21E26]" /> Payout Requests
        </h2>

        {payoutRequests.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center italic">No payout requests yet.</p>
        ) : (
          <div className="space-y-3">
            {payoutRequests.map(po => (
              <div key={po.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-gray-900">{po.id}</span>
                    {po.payoutMethod && <span className="text-[10px] text-gray-500 font-mono">({po.payoutMethod})</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{po.targetDetails || '—'} • {when(po.requestedAt)}</p>
                  {po.utr && <p className="text-[11px] text-emerald-700 mt-0.5">Transfer reference (UTR): {po.utr}</p>}
                  {po.adminNote && <p className="text-[11px] text-gray-600 mt-0.5">NESAM note: {po.adminNote}</p>}
                </div>

                <div className="text-right">
                  <span className="text-sm font-black text-gray-900">{rupees(po.amount)}</span>
                  <span className={`block text-[10px] font-bold px-2 py-0.5 rounded mt-0.5 ${payoutStyle[po.status] || 'text-gray-600 bg-gray-100'}`}>
                    {po.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ledger */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center gap-2">
          <History className="w-4 h-4 text-[#E21E26]" />
          <h3 className="text-[14px] font-bold text-[#111]">Wallet Ledger</h3>
        </div>
        {transactions.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center italic">No ledger entries yet. Earnings are recorded when a trip is completed with a verified fare.</p>
        ) : (
          <div className="divide-y divide-[#F5F5F5]">
            {transactions.map((txn) => (
              <div key={txn.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[12px] font-semibold text-[#111]">
                    {ENTRY_LABEL[txn.type] || txn.type}
                    {txn.bookingCode && <span className="font-mono text-[11px] text-[#666]"> · {txn.bookingCode}</span>}
                  </div>
                  <div className="text-[11px] text-[#999]">{when(txn.createdAt)} • {ENTRY_STATUS[txn.status] || txn.status}</div>
                </div>
                <div className={`text-[13px] font-bold ${txn.status === 'cancelled' ? 'text-gray-400 line-through' : txn.direction === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                  {txn.direction === 'credit' ? '+' : '−'}₹{txn.amount.toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

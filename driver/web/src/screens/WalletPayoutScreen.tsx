import React, { useState } from 'react';
import { WalletDetails, PayoutRequest, TransactionRecord } from '../types';
import {
  Wallet,
  ArrowUpRight,
  Clock,
  CheckCircle,
  Building2,
  Send,
  History,
  AlertCircle
} from 'lucide-react';

interface WalletPayoutScreenProps {
  wallet: WalletDetails;
  payoutRequests: PayoutRequest[];
  transactions: TransactionRecord[];
  onRequestPayout: (amount: number, method: 'UPI' | 'Bank Transfer', details: string) => void;
}

export const WalletPayoutScreen: React.FC<WalletPayoutScreenProps> = ({
  wallet,
  payoutRequests,
  transactions,
  onRequestPayout
}) => {
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [payoutAmount, setPayoutAmount] = useState<number>(wallet.availableBalance);
  const [payoutMethod, setPayoutMethod] = useState<'UPI' | 'Bank Transfer'>('UPI');
  const [upiId, setUpiId] = useState<string>(wallet.upiId || 'muthukumar@okaxis');
  const [payoutSuccess, setPayoutSuccess] = useState<boolean>(false);

  const handleSubmitPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (payoutAmount > wallet.availableBalance) return;

    const details = payoutMethod === 'UPI' ? upiId : `${wallet.bankAccountName} - ${wallet.bankAccountNumber}`;
    onRequestPayout(payoutAmount, payoutMethod, details);
    setShowPayoutModal(false);
    setPayoutSuccess(true);
    setTimeout(() => setPayoutSuccess(false), 4000);
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl mx-auto">

      {/* Wallet Balance Hero Banner */}
      <div className="bg-white text-gray-900 p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#E21E26]">
              NESAM DRIVER WALLET
            </span>
            <p className="text-xs text-gray-500 mt-0.5">Available for instant withdrawal to Bank or UPI</p>
            <div className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">
              ₹{wallet.availableBalance.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-amber-600 mt-1 font-medium">
              + ₹{wallet.pendingBalance} pending trip clearance
            </p>
          </div>

          <button
            onClick={() => setShowPayoutModal(true)}
            className="px-6 py-3 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-black rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer w-full md:w-auto"
          >
            <ArrowUpRight className="w-4 h-4" /> Request Instant Payout
          </button>
        </div>
      </div>

      {payoutSuccess && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Payout request submitted! Funds will reflect in your account within 15 minutes.</span>
        </div>
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-gray-900">Request Payout Withdrawal</h2>
              <span className="text-xs text-gray-500 font-mono">Bal: ₹{wallet.availableBalance}</span>
            </div>

            <form onSubmit={handleSubmitPayout} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Withdrawal Amount (₹)</label>
                <input
                  type="number"
                  max={wallet.availableBalance}
                  min={100}
                  value={payoutAmount}
                  onChange={e => setPayoutAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-mono font-bold text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Payout Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('UPI')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      payoutMethod === 'UPI' ? 'bg-[#E21E26] text-white border-[#E21E26]' : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    UPI Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('Bank Transfer')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      payoutMethod === 'Bank Transfer' ? 'bg-[#E21E26] text-white border-[#E21E26]' : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    Bank NEFT / IMPS
                  </button>
                </div>
              </div>

              {payoutMethod === 'UPI' ? (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">UPI ID (VPA)</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={e => setUpiId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono font-bold"
                    placeholder="e.g. mobile@upi"
                    required
                  />
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-1">
                  <span className="font-bold text-gray-700">Bank Account Details:</span>
                  <p className="text-gray-600 font-mono">{wallet.bankAccountName}</p>
                  <p className="text-gray-600 font-mono">{wallet.bankAccountNumber} ({wallet.ifscCode})</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="px-4 py-2 border text-xs font-bold text-gray-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-bold rounded-xl shadow"
                >
                  Confirm Payout Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payout History */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#E21E26]" /> Payout Requests History
        </h2>

        <div className="space-y-3">
          {payoutRequests.map(po => (
            <div key={po.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-gray-900">{po.id}</span>
                  <span className="text-[10px] text-gray-500 font-mono">({po.payoutMethod})</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{po.targetDetails} • {po.requestedAt}</p>
              </div>

              <div className="text-right">
                <span className="text-sm font-black text-gray-900">₹{po.amount}</span>
                <span className="block text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded mt-0.5">
                  {po.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History Ledger */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <History className="w-5 h-5 text-[#E21E26]" /> Wallet Transaction Ledger
        </h2>

        <div className="space-y-3">
          {transactions.map(txn => (
            <div key={txn.id} className="flex items-center justify-between p-3 border-b last:border-0 text-xs">
              <div>
                <span className="font-bold text-gray-900">{txn.description}</span>
                <p className="text-[10px] text-gray-400 mt-0.5">{txn.timestamp}</p>
              </div>

              <div className={`font-mono font-extrabold text-sm ${txn.isCredit ? 'text-emerald-600' : 'text-[#E21E26]'}`}>
                {txn.isCredit ? `+ ₹${txn.amount}` : `- ₹${txn.amount}`}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

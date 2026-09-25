import React, { useState } from 'react';
import { WalletDetails, PayoutRequest, TransactionRecord } from '../types';
import { Wallet, ArrowUpRight, Clock, CheckCircle, History, AlertCircle } from 'lucide-react';

import { subscribeToVendorWalletBalance } from '../services/vendorFirestoreService';

interface WalletPayoutScreenProps {
  vendorId: string;
  wallet: WalletDetails;
  payoutRequests: PayoutRequest[];
  transactions: TransactionRecord[];
  onRequestPayout: (amount: number, method: 'UPI' | 'Bank Transfer', details: string) => void;
}

export const WalletPayoutScreen: React.FC<WalletPayoutScreenProps> = ({
  vendorId,
  wallet,
  payoutRequests,
  transactions,
  onRequestPayout
}) => {
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutMethod, setPayoutMethod] = useState<'UPI' | 'Bank Transfer'>('Bank Transfer');
  const [targetDetails, setTargetDetails] = useState<string>(`${wallet.bankAccountName} - ${wallet.bankAccountNumber}`);
  const [payoutSuccess, setPayoutSuccess] = useState<boolean>(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!vendorId) return;
    const unsub = subscribeToVendorWalletBalance(vendorId, setWalletBalance);
    return () => unsub();
  }, [vendorId]);

  React.useEffect(() => {
    setPayoutAmount(walletBalance);
  }, [walletBalance]);

  const handleSubmitPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (payoutAmount > walletBalance) {
      setError('Requested amount exceeds available balance of ₹' + walletBalance.toLocaleString('en-IN'));
      return;
    }

    onRequestPayout(payoutAmount, payoutMethod, targetDetails);
    setShowPayoutModal(false);
    setPayoutSuccess(true);
    setTimeout(() => setPayoutSuccess(false), 4000);
  };

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
            <p className="text-xs text-gray-400 mt-0.5">Available for instant corporate payout withdrawal</p>
            <div className="text-4xl font-black text-white mt-2">
              ₹{walletBalance.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-amber-400 mt-1 font-medium">
              + ₹{wallet.pendingBalance.toLocaleString('en-IN')} pending trip completion
            </p>
          </div>

          <button
            onClick={() => setShowPayoutModal(true)}
            className="px-6 py-3 bg-[#E21E26] hover:bg-[#C9141B] text-white text-xs font-black rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" /> Request Fleet Payout
          </button>
        </div>
      </div>

      {payoutSuccess && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Payout request submitted to Finance Team! Funds will reflect in your registered account shortly.</span>
        </div>
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-gray-900">Request Corporate Payout</h2>
              <span className="text-xs text-gray-500 font-mono">Bal: ₹{walletBalance.toLocaleString('en-IN')}</span>
            </div>
            {error && <div className="text-xs text-red-600 font-semibold">{error}</div>}

            <form onSubmit={handleSubmitPayout} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Withdrawal Amount (₹)</label>
                <input
                  type="number"
                  max={walletBalance}
                  min={1000}
                  value={payoutAmount}
                  onChange={e => { setPayoutAmount(Number(e.target.value)); setError(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-mono font-bold text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Payout Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPayoutMethod('Bank Transfer');
                      setTargetDetails(`${wallet.bankAccountName} - ${wallet.bankAccountNumber}`);
                    }}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      payoutMethod === 'Bank Transfer' ? 'bg-[#E21E26] text-white border-[#E21E26]' : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    Bank NEFT / IMPS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPayoutMethod('UPI');
                      setTargetDetails(wallet.upiId);
                    }}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      payoutMethod === 'UPI' ? 'bg-[#E21E26] text-white border-[#E21E26]' : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    Corporate UPI
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Registered Account Details</label>
                <input
                  type="text"
                  value={targetDetails}
                  onChange={e => setTargetDetails(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono font-bold"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
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

      {/* Payout Requests History */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#E21E26]" /> Payout Requests Log
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
                <span className="text-sm font-black text-gray-900">₹{po.amount.toLocaleString('en-IN')}</span>
                <span className="block text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded mt-0.5">
                  {po.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {transactions.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E5E5]">
            <h3 className="text-[14px] font-bold text-[#111]">Transaction History</h3>
          </div>
          <div className="divide-y divide-[#F5F5F5]">
            {transactions.map((txn) => (
              <div key={txn.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-semibold text-[#111]">{txn.type || 'Transaction'}</div>
                  <div className="text-[11px] text-[#999]">{txn.timestamp || txn.description}</div>
                </div>
                <div className={`text-[13px] font-bold ${txn.isCredit ? 'text-green-600' : 'text-red-600'}`}>
                  {txn.isCredit ? '+' : '-'}₹{txn.amount?.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Coupon } from '../types';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

export const OffersScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'coupons'), where('active', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, []);

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-2xl w-full mx-auto">
      {onBack && (
        <button onClick={onBack} className="text-sm font-semibold text-[#E31E24]">
          ← Back
        </button>
      )}
      <div>
        <h2 className="text-lg font-black text-gray-900">Offers</h2>
        <p className="text-xs text-gray-500">Enter a code under “Add promo code” when booking</p>
      </div>
      {coupons === null ? (
        <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
      ) : coupons.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-sm text-gray-500">No offers running right now — check back soon.</div>
      ) : (
        coupons.map((c) => (
          <div key={c.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-gray-900">
                {c.discountType === 'PERCENTAGE'
                  ? `${c.discountValue}% off${c.maximumDiscount ? ` (up to ₹${c.maximumDiscount})` : ''}`
                  : `₹${c.discountValue} off`}
              </div>
              <p className="text-xs text-gray-600">{c.description || c.name}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {c.minimumBookingAmount ? `Min fare ₹${c.minimumBookingAmount} · ` : ''}
                {c.firstBookingOnly ? 'First ride only · ' : ''}
                {c.validUntil ? `Valid till ${c.validUntil}` : 'No expiry'}
              </p>
            </div>
            <button onClick={() => void handleCopy(c.code)} className="shrink-0 border-2 border-dashed border-[#E31E24] text-[#E31E24] font-black text-xs px-3 py-2 rounded-xl">
              {copiedCode === c.code ? 'Copied!' : c.code}
            </button>
          </div>
        ))
      )}
    </div>
  );
};

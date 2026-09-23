import React from 'react';
import { activeOffers } from '../config/constants';

export const OffersScreen: React.FC<{ onApplyOffer?: (code: string) => void; onBack?: () => void }> = ({ onApplyOffer, onBack }) => {
  return (
    <div className="flex-1 bg-[#F7F7F7] overflow-y-auto p-4 space-y-3 max-w-3xl w-full mx-auto">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-[#E21B23] mb-2">
          ← Back
        </button>
      )}
      <div>
        <h2 className="text-sm font-black text-[#111111] uppercase tracking-wider">OFFERS & PROMOTIONS</h2>
        <p className="text-[10px] text-gray-500">Exclusive discount codes for your rides</p>
      </div>

      <div className="space-y-3">
        {activeOffers.map((offer) => (
          <div
            key={offer.code}
            className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-2 relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-extrabold text-white bg-[#E31E24] px-2 py-0.5 rounded-full uppercase">
                  DISCOUNT
                </span>
                <h3 className="text-sm font-black text-[#111111] mt-1">{offer.discount}</h3>
                <p className="text-xs text-gray-600">{offer.desc}</p>
              </div>
            </div>

            <div className="flex justify-between items-center bg-gray-100 p-2.5 rounded-xl border border-dashed border-gray-300 text-xs">
              <span className="font-mono font-black text-[#111111] tracking-wider">{offer.code}</span>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(offer.code);
                  alert(`Copied coupon code ${offer.code}`);
                  if (onApplyOffer) onApplyOffer(offer.code);
                }}
                className="text-[10px] font-extrabold text-[#E31E24] hover:underline"
              >
                COPY CODE
              </button>
            </div>

            <div className="text-[9px] text-gray-400 text-right">Valid till {offer.validTill}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { FareLine, PaymentSummary } from '../types';

const rupees = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN')}`;

const BADGE: Record<FareLine['treatment'], string> = {
  included: 'bg-green-50 text-green-800 border-green-300',
  extra: 'bg-amber-50 text-amber-900 border-amber-300',
  not_applicable: 'bg-gray-100 text-gray-700 border-gray-300',
};
const BADGE_TEXT: Record<FareLine['treatment'], string> = { included: 'Included', extra: 'Extra · customer pays separately', not_applicable: 'Not applicable' };

/**
 * The customer's fare as the booking stored it: what is inside the package and what
 * the customer pays separately (toll, parking, waiting…), plus what has been paid so far.
 */
export const FarePanel: React.FC<{ fare: number; lines: FareLine[] | null; payment: PaymentSummary | null }> = ({ fare, lines, payment }) => {
  const [open, setOpen] = useState(false);
  const extras = (lines ?? []).filter((l) => l.treatment === 'extra');
  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Customer fare</p>
          <p className="text-xl font-black text-gray-900">{rupees(fare)}</p>
        </div>
        {payment && (
          <div className="text-right text-sm">
            <p className="text-gray-700">Paid <strong className="text-emerald-700">{rupees(payment.totalPaid)}</strong></p>
            <p className="text-gray-700">Balance <strong className={payment.balanceDue > 0 ? 'text-[#E21E26]' : 'text-gray-900'}>{rupees(payment.balanceDue)}</strong></p>
          </div>
        )}
      </div>
      {extras.length > 0 && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          The customer pays these separately, at actual cost: {extras.map((l) => `${l.label}${l.amount ? ` ${rupees(l.amount)}` : ''}`).join(', ')}. Record tolls with their receipt at the end of the trip.
        </p>
      )}
      {lines && lines.length > 0 && (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-bold text-[#E21E26] flex items-center gap-1" aria-expanded={open}>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} Fare breakup
          </button>
          {open && (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl">
              {lines.map((l) => (
                <li key={l.key} className="flex items-start justify-between gap-3 p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{l.label}</p>
                    <p className="text-xs text-gray-600">{l.detail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{l.amount === null ? '—' : l.amount < 0 ? `− ${rupees(-l.amount)}` : rupees(l.amount)}</p>
                    <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded border text-[11px] font-semibold ${BADGE[l.treatment]}`}>{BADGE_TEXT[l.treatment]}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

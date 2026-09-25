import React from 'react';

type Tone = 'searching' | 'partner_confirmed' | 'driver_en_route' | 'driver_arrived' | 'in_trip' | 'completed' | 'cancelled' | string;

const TONES: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  searching: 'bg-amber-50 text-amber-700 border-amber-200',
  partner_confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  driver_en_route: 'bg-red-50 text-[#E31E24] border-red-200',
  driver_arrived: 'bg-red-50 text-[#E31E24] border-red-200',
  in_trip: 'bg-red-50 text-[#E31E24] border-red-200',
};

export const StatusBadge: React.FC<{ status: string; tone?: Tone }> = ({ status, tone }) => (
  <span
    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
      TONES[tone ?? ''] ?? 'bg-gray-100 text-gray-700 border-gray-300'
    }`}
  >
    <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
    {status}
  </span>
);

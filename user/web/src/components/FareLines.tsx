import React from 'react';
import { FareBreakdown } from '../types';
import { formatINR } from '../utils/format';

export const FareLines: React.FC<{ fare: FareBreakdown; tolls?: number }> = ({ fare, tolls = 0 }) => {
  const rows: [string, number][] = [
    ['Base fare', fare.baseFare],
    [`Distance (${fare.distanceKm} km @ ₹${fare.perKmRate}/km)`, fare.distanceFare],
    ...(fare.timeFare ? ([[`Time (${fare.durationMin} min)`, fare.timeFare]] as [string, number][]) : []),
    ...(fare.nightCharge ? ([['Night charge', fare.nightCharge]] as [string, number][]) : []),
    ...(fare.driverAllowance ? ([['Driver allowance (outstation)', fare.driverAllowance]] as [string, number][]) : []),
    ...(fare.minimumFareAdjustment ? ([['Minimum fare adjustment', fare.minimumFareAdjustment]] as [string, number][]) : []),
    ...(fare.discount ? ([['Promo discount', -fare.discount]] as [string, number][]) : []),
    [`GST (${Math.round(fare.gstRate * 100)}%)`, fare.gst],
    ...(tolls ? ([['Tolls & parking', tolls]] as [string, number][]) : []),
  ];
  return (
    <dl className="mt-2 space-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <dt>{k}</dt>
          <dd className={`font-semibold tabular-nums ${v < 0 ? 'text-emerald-700' : 'text-gray-900'}`}>
            {v < 0 ? `−${formatINR(-v)}` : formatINR(v)}
          </dd>
        </div>
      ))}
      <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5 text-sm font-black text-gray-900">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatINR(fare.total + tolls)}</dd>
      </div>
    </dl>
  );
};

import React from 'react';
import { TripRecord } from '../types';
import { FareLines } from './FareLines';
import { COMPANY_NAME, COMPANY_UPI_ID } from '../config/constants';
import { escapeHtml, formatDateTime, formatDistance, formatDuration, formatINR } from '../utils/format';

export function payableAmount(trip: TripRecord): number {
  const base = trip.fareBreakdown?.total ?? trip.fare;
  return Math.round(base + trip.tollCharges);
}

function upiLink(trip: TripRecord): string {
  const params = new URLSearchParams({
    pa: COMPANY_UPI_ID,
    pn: COMPANY_NAME,
    am: payableAmount(trip).toFixed(2),
    cu: 'INR',
    tn: `Ride ${trip.bookingId}`,
  });
  return `upi://pay?${params.toString()}`;
}

/** Opens a print-ready receipt. All values are HTML-escaped. */
export function printReceipt(trip: TripRecord, customerName: string): void {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Please allow pop-ups for this site to download your receipt.');
    return;
  }
  const f = trip.fareBreakdown;
  const row = (label: string, amount: number) =>
    `<tr><td>${escapeHtml(label)}</td><td class="r">${amount < 0 ? '−' : ''}₹${Math.abs(Math.round(amount)).toLocaleString('en-IN')}</td></tr>`;
  const rows = f
    ? [
        row('Base fare', f.baseFare),
        row(`Distance (${f.distanceKm} km @ ₹${f.perKmRate}/km)`, f.distanceFare),
        f.timeFare ? row(`Time (${f.durationMin} min)`, f.timeFare) : '',
        f.nightCharge ? row('Night charge', f.nightCharge) : '',
        f.driverAllowance ? row('Driver allowance', f.driverAllowance) : '',
        f.minimumFareAdjustment ? row('Minimum fare adjustment', f.minimumFareAdjustment) : '',
        f.discount ? row(`Promo discount${trip.couponCode ? ` (${trip.couponCode})` : ''}`, -f.discount) : '',
        row(`GST (${Math.round(f.gstRate * 100)}%)`, f.gst),
      ].join('')
    : row('Ride fare', trip.fare);
  const tolls = trip.tollCharges ? row('Tolls & parking', trip.tollCharges) : '';

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${escapeHtml(trip.bookingId)}</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;margin:32px;color:#111;max-width:640px}
h1{font-size:20px;margin:0;color:#E31E24}.muted{color:#666;font-size:12px}
.box{border:1px solid #e5e5e5;border-radius:8px;padding:12px;margin:14px 0;font-size:13px;line-height:1.6}
table{width:100%;border-collapse:collapse;font-size:13px}td{padding:6px 0;border-bottom:1px solid #eee}.r{text-align:right}
.total td{font-weight:700;font-size:15px;border-top:2px solid #111;border-bottom:none}
</style></head><body>
<h1>${escapeHtml(COMPANY_NAME)}</h1><div class="muted">Ride receipt · Booking ${escapeHtml(trip.bookingId)}</div>
<div class="box"><b>Customer:</b> ${escapeHtml(customerName)}<br>
<b>Trip:</b> ${escapeHtml(trip.pickup.name)} → ${escapeHtml(trip.drop.name)}<br>
<b>Service:</b> ${escapeHtml(trip.service)} · ${escapeHtml(trip.tripType)} · ${escapeHtml(trip.categoryName)}<br>
<b>Started:</b> ${escapeHtml(formatDateTime(trip.startedAt))} · <b>Completed:</b> ${escapeHtml(formatDateTime(trip.completedAt))}<br>
${trip.driver ? `<b>Driver:</b> ${escapeHtml(trip.driver.name)} · ${escapeHtml(trip.driver.vehicleNumber)}<br>` : ''}
<b>Payment:</b> ${escapeHtml(trip.paymentMethod)} (${escapeHtml(trip.paymentStatus)})</div>
<table>${rows}${tolls}<tr class="total"><td>Total</td><td class="r">₹${payableAmount(trip).toLocaleString('en-IN')}</td></tr></table>
<p class="muted">Upfront fare based on ${escapeHtml(formatDistance(trip.distanceKm))} / ${escapeHtml(formatDuration(trip.durationMin))} estimated. Thank you for riding with NESAM.</p>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}

export const TripReceipt: React.FC<{ trip: TripRecord; customerName: string }> = ({ trip, customerName }) => {
  const amount = payableAmount(trip);
  const paid = trip.paymentStatus === 'Paid';
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Receipt</span>
          <span className="text-[11px] text-gray-500">{trip.bookingId}</span>
        </div>
        {trip.fareBreakdown ? (
          <div className="text-xs text-gray-600">
            <FareLines fare={trip.fareBreakdown} tolls={trip.tollCharges} />
          </div>
        ) : (
          <div className="mt-2 flex justify-between text-sm font-black">
            <span>Total</span>
            <span>{formatINR(amount)}</span>
          </div>
        )}
        <button onClick={() => printReceipt(trip, customerName)} className="mt-3 text-xs font-bold text-[#E31E24] hover:underline">
          Download / print receipt
        </button>
      </div>

      <div className={`rounded-2xl p-4 text-sm ${paid ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-900 text-white'}`}>
        {paid ? (
          <p className="font-bold text-emerald-800">Paid {formatINR(amount)} via {trip.paymentMethod}. Thank you!</p>
        ) : trip.paymentMethod === 'Cash' ? (
          <>
            <p className="text-xs uppercase tracking-wider opacity-70 font-bold">Pay cash to your driver</p>
            <p className="text-3xl font-black mt-1">{formatINR(amount)}</p>
            <p className="text-xs opacity-80 mt-1">Your driver will confirm the payment once collected.</p>
          </>
        ) : trip.paymentMethod === 'UPI' ? (
          <>
            <p className="text-xs uppercase tracking-wider opacity-70 font-bold">Pay by UPI</p>
            <p className="text-3xl font-black mt-1">{formatINR(amount)}</p>
            {COMPANY_UPI_ID ? (
              <a href={upiLink(trip)} className="mt-3 inline-flex bg-white text-gray-900 font-bold text-sm px-4 py-2 rounded-xl">
                Open UPI app
              </a>
            ) : (
              <p className="text-xs opacity-80 mt-1">Scan your driver’s UPI QR code to pay.</p>
            )}
            <p className="text-[11px] opacity-70 mt-2">Payment status updates once it’s confirmed.</p>
          </>
        ) : trip.paymentMethod === 'Wallet' ? (
          <>
            <p className="text-xs uppercase tracking-wider opacity-70 font-bold">NESAM Wallet</p>
            <p className="text-3xl font-black mt-1">{formatINR(amount)}</p>
            <p className="text-xs opacity-80 mt-1">This amount will be deducted from your wallet. Nothing to pay the driver.</p>
          </>
        ) : (
          <p>
            Amount due: <strong>{formatINR(amount)}</strong> ({trip.paymentMethod})
          </p>
        )}
      </div>
    </div>
  );
};

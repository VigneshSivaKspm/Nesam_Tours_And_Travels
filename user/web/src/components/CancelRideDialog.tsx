import React, { useEffect, useState } from 'react';
import { TripRecord } from '../types';
import { cancelRide, cancellationQuote } from '../services/rideService';
import { CANCEL_REASONS } from '../config/constants';
import { describeError } from '../utils/retry';
import { ErrorNotice, Modal, Spinner } from './ui';

interface CancelRideDialogProps {
  trip: TripRecord | null;
  customerId: string;
  onClose: () => void;
  onCancelled?: () => void;
}

export const CancelRideDialog: React.FC<CancelRideDialogProps> = ({ trip, customerId, onClose, onCancelled }) => {
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [, tick] = useState(0);

  // The fee depends on elapsed time — keep the quote current while open.
  useEffect(() => {
    if (!trip) return undefined;
    setReason('');
    setOther('');
    setError('');
    const t = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, [trip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trip) return null;
  const quote = cancellationQuote(trip);
  const finalReason = reason === 'Other' ? other.trim() : reason;

  const confirm = async () => {
    if (!finalReason) {
      setError('Please tell us why you’re cancelling.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await cancelRide(trip, customerId, finalReason);
      onCancelled?.();
      onClose();
    } catch (e) {
      setError(describeError(e, 'We couldn’t cancel this ride. Please try again or call support.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => undefined : onClose} title={`Cancel ride ${trip.bookingId}?`} dismissible={!busy}>
      {!quote.allowed ? (
        <p className="text-sm text-gray-700">{quote.explanation}</p>
      ) : (
        <div className="space-y-4">
          <div className={`rounded-xl p-3 text-xs ${quote.fee ? 'bg-amber-50 border border-amber-200 text-amber-900' : 'bg-emerald-50 border border-emerald-200 text-emerald-900'}`}>
            <strong>{quote.fee ? `Cancellation fee: ₹${quote.fee}` : 'Free cancellation'}</strong>
            <p className="mt-0.5">{quote.explanation}</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-gray-700 mb-1">Why are you cancelling?</legend>
            {CANCEL_REASONS.map((r) => (
              <label
                key={r}
                className={`flex items-center gap-3 p-3 rounded-xl border text-sm cursor-pointer ${
                  reason === r ? 'border-[#E31E24] bg-red-50 font-semibold' : 'border-gray-200'
                }`}
              >
                <input type="radio" name="cancel-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[#E31E24]" />
                {r}
              </label>
            ))}
          </fieldset>
          {reason === 'Other' && (
            <textarea
              value={other}
              onChange={(e) => setOther(e.target.value.slice(0, 200))}
              rows={2}
              placeholder="Tell us more"
              aria-label="Cancellation reason"
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm"
            />
          )}
          {error && <ErrorNotice message={error} />}
          <div className="flex gap-2">
            <button onClick={onClose} disabled={busy} className="flex-1 bg-gray-100 text-gray-800 py-3 rounded-2xl font-bold text-sm">
              Keep ride
            </button>
            <button
              onClick={() => void confirm()}
              disabled={busy || !finalReason}
              className="flex-1 bg-[#D92D20] text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-50 flex items-center justify-center"
            >
              {busy ? <Spinner label="Cancelling…" /> : 'Cancel ride'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

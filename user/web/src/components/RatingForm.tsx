import React, { useState } from 'react';
import { TripRecord, UserProfile } from '../types';
import { rateTrip } from '../services/rideService';
import { describeError } from '../utils/retry';
import { ErrorNotice, Spinner, primaryBtn } from './ui';

const LABELS = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Excellent'];
const TAGS: Record<'low' | 'high', string[]> = {
  low: ['Late pickup', 'Rash driving', 'Unclean car', 'Rude behaviour', 'Wrong route', 'Asked for extra money'],
  high: ['Safe driving', 'Clean car', 'Polite driver', 'On time', 'Smooth ride', 'Helped with luggage'],
};

export const RatingForm: React.FC<{ trip: TripRecord; profile: UserProfile; onDone?: () => void }> = ({ trip, profile, onDone }) => {
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (trip.rating != null) {
    return (
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 text-center">
        <p className="text-amber-500 text-xl" aria-label={`${trip.rating} stars`}>
          {'★'.repeat(trip.rating)}
          <span className="text-gray-300">{'★'.repeat(5 - trip.rating)}</span>
        </p>
        <p className="text-xs text-gray-600 mt-1">Thanks for rating your trip!</p>
      </div>
    );
  }

  const submit = async () => {
    if (!stars) {
      setError('Tap a star to rate your driver.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const text = [tags.join(', '), comment.trim()].filter(Boolean).join(' — ');
      await rateTrip(trip, profile, stars, text);
      onDone?.();
    } catch (e) {
      setError(describeError(e, 'We couldn’t save your rating. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const tagSet = stars && stars <= 3 ? TAGS.low : TAGS.high;
  return (
    <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
      <p className="text-sm font-bold text-gray-900 text-center">How was your ride{trip.driver ? ` with ${trip.driver.name}` : ''}?</p>
      <div className="flex justify-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={stars === s}
            aria-label={`${s} star${s > 1 ? 's' : ''}`}
            onClick={() => {
              setStars(s);
              setTags([]);
              setError('');
            }}
            className={`text-4xl leading-none px-1 transition-transform hover:scale-110 ${s <= stars ? 'text-amber-400' : 'text-gray-200'}`}
          >
            ★
          </button>
        ))}
      </div>
      <p className="text-center text-xs font-semibold text-gray-500 h-4">{LABELS[stars]}</p>
      {stars > 0 && (
        <>
          <div className="flex flex-wrap gap-2 justify-center">
            {tagSet.map((t) => (
              <button
                key={t}
                onClick={() => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}
                aria-pressed={tags.includes(t)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border ${
                  tags.includes(t) ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 400))}
            rows={2}
            placeholder="Anything else? (optional)"
            aria-label="Feedback"
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm"
          />
        </>
      )}
      {error && <ErrorNotice message={error} />}
      <button onClick={() => void submit()} disabled={busy || !stars} className={primaryBtn}>
        {busy ? <Spinner label="Submitting…" /> : 'Submit rating'}
      </button>
    </div>
  );
};

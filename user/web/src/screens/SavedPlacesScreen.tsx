import React, { useEffect, useState } from 'react';
import { GeoPlace, LocationItem } from '../types';
import { deleteSavedPlace, savePlace, subscribeToSavedPlaces } from '../services/userFirestoreService';
import { PlaceSearch } from '../components/PlaceSearch';
import { ErrorNotice, Spinner, inputCls, labelCls, primaryBtn } from '../components/ui';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import { describeError } from '../utils/retry';

const TYPES: { id: LocationItem['type']; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'work', label: 'Work', icon: '💼' },
  { id: 'favorite', label: 'Favourite', icon: '★' },
];

export const SavedPlacesScreen: React.FC<{ ownerId: string; onBack: () => void }> = ({ ownerId, onBack }) => {
  const [places, setPlaces] = useState<LocationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<GeoPlace | null>(null);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<LocationItem['type']>('favorite');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { position } = useDeviceLocation(false);

  useEffect(
    () =>
      subscribeToSavedPlaces(ownerId, (p) => {
        setPlaces(p);
        setLoaded(true);
      }),
    [ownerId],
  );

  const reset = () => {
    setAdding(false);
    setPicked(null);
    setLabel('');
    setType('favorite');
  };

  const add = async () => {
    if (!picked) return setError('Search for the place to save.');
    const name = type === 'home' ? 'Home' : type === 'work' ? 'Work' : label.trim() || picked.name;
    // Only one Home and one Work: replace the existing entry.
    const existing = type !== 'favorite' ? places.find((p) => p.type === type) : undefined;
    setBusy(true);
    setError('');
    try {
      await savePlace({ ...picked, id: existing?.id ?? '', name, address: picked.address, type }, ownerId);
      reset();
    } catch (e) {
      setError(describeError(e, 'Couldn’t save this place.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setDeleting(id);
    setError('');
    try {
      await deleteSavedPlace(id);
    } catch (e) {
      setError(describeError(e, 'Couldn’t remove this place.'));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl w-full mx-auto">
      <button onClick={onBack} className="text-sm font-semibold text-[#E31E24]">
        ← Back
      </button>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-black text-gray-900">Saved places</h2>
          <p className="text-xs text-gray-500">One-tap pickup and destination</p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="bg-[#E31E24] text-white px-4 py-2 rounded-xl text-xs font-bold">
            + Add place
          </button>
        )}
      </div>

      {error && <ErrorNotice message={error} />}

      {adding && (
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                aria-pressed={type === t.id}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border ${type === t.id ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200'}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <PlaceSearch
            label="Place"
            placeholder="Search address or landmark"
            accent="drop"
            value={picked}
            onSelect={setPicked}
            savedPlaces={[]}
            recentPlaces={[]}
            near={position}
            autoFocus
          />
          {type === 'favorite' && (
            <div>
              <label htmlFor="sp-label" className={labelCls}>
                Label (optional)
              </label>
              <input id="sp-label" value={label} onChange={(e) => setLabel(e.target.value.slice(0, 40))} placeholder="e.g. Grandma’s house" className={inputCls} />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={reset} disabled={busy} className="flex-1 bg-gray-100 py-3 rounded-2xl text-sm font-bold">
              Cancel
            </button>
            <button onClick={() => void add()} disabled={busy || !picked} className={`${primaryBtn} flex-1`}>
              {busy ? <Spinner label="Saving…" /> : 'Save place'}
            </button>
          </div>
        </div>
      )}

      {!loaded ? (
        <div className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
      ) : places.length === 0 && !adding ? (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-sm text-gray-500">No saved places yet. Add Home and Work for one-tap booking.</div>
      ) : (
        <ul className="space-y-2">
          {places.map((p) => (
            <li key={p.id} className="bg-white p-3.5 rounded-2xl border border-gray-200 flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-red-50 text-[#E31E24] flex items-center justify-center shrink-0">
                {TYPES.find((t) => t.id === p.type)?.icon ?? '📍'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900">{p.name}</div>
                <div className="text-[11px] text-gray-500 truncate">{p.address}</div>
                {(p.lat == null || p.lng == null) && <div className="text-[10px] text-amber-700">No map position — re-add it to use it for booking.</div>}
              </div>
              <button
                onClick={() => void remove(p.id)}
                disabled={deleting === p.id}
                className="text-[11px] font-bold text-gray-400 hover:text-red-600 px-2"
              >
                {deleting === p.id ? <Spinner className="w-3 h-3" /> : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

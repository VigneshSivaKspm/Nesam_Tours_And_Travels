import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { GeoPlace, LatLng, LocationItem } from '../types';
import { searchPlaces } from '../services/geoService';
import { isValidLatLng } from '../utils/geo';
import { Spinner } from './ui';

interface PlaceSearchProps {
  label: string;
  placeholder: string;
  accent: 'pickup' | 'drop';
  value: GeoPlace | null;
  onSelect: (place: GeoPlace) => void;
  savedPlaces: LocationItem[];
  recentPlaces: GeoPlace[];
  near: LatLng | null;
  onUseCurrentLocation?: () => void;
  locating?: boolean;
  autoFocus?: boolean;
  onClear?: () => void;
}

type Option =
  | { kind: 'current' }
  | { kind: 'place'; place: LocationItem; group: 'Saved' | 'Recent' | 'Results' };

const TYPE_ICON: Record<string, string> = { home: '🏠', work: '💼', favorite: '★', airport: '✈', recent: '🕘' };

export const PlaceSearch: React.FC<PlaceSearchProps> = ({
  label,
  placeholder,
  accent,
  value,
  onSelect,
  savedPlaces,
  recentPlaces,
  near,
  onUseCurrentLocation,
  locating,
  autoFocus,
  onClear,
}) => {
  const [text, setText] = useState(value?.name ?? '');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Reflect external changes (map pin moved, saved place picked elsewhere).
  useEffect(() => {
    if (!open) setText(value?.name ?? '');
  }, [value?.id, value?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search with cancellation of stale requests.
  useEffect(() => {
    const q = text.trim();
    if (!open || q.length < 3 || q === value?.name) {
      setResults([]);
      setLoading(false);
      setError('');
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      searchPlaces(q, near, controller.signal)
        .then((r) => {
          setResults(r);
          setError(r.length ? '' : 'No places found. Try a landmark, area or city name.');
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          console.warn('[search]', e);
          setResults([]);
          setError(navigator.onLine ? 'Search is temporarily unavailable. Please try again.' : 'You’re offline — search needs a connection.');
        })
        .finally(() => !controller.signal.aborted && setLoading(false));
    }, 350);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [text, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setText(value?.name ?? '');
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, value?.name]);

  const q = text.trim().toLowerCase();
  const options: Option[] = useMemo(() => {
    const out: Option[] = [];
    const typing = open && q.length >= 3 && q !== value?.name.toLowerCase();
    if (!typing && onUseCurrentLocation) out.push({ kind: 'current' });
    const saved = savedPlaces.filter((p) => !typing || `${p.name} ${p.address}`.toLowerCase().includes(q));
    for (const p of saved.slice(0, 5)) out.push({ kind: 'place', place: p, group: 'Saved' });
    if (!typing) for (const p of recentPlaces.slice(0, 4)) out.push({ kind: 'place', place: p, group: 'Recent' });
    if (typing) for (const p of results) out.push({ kind: 'place', place: p, group: 'Results' });
    return out;
  }, [open, q, savedPlaces, recentPlaces, results, onUseCurrentLocation, value?.name]);

  useEffect(() => setActive(0), [options.length]);

  const choose = async (opt: Option) => {
    if (opt.kind === 'current') {
      setOpen(false);
      onUseCurrentLocation?.();
      return;
    }
    const p = opt.place;
    if (isValidLatLng(p as Partial<LatLng>)) {
      onSelect(p as GeoPlace);
      setText(p.name);
      setOpen(false);
      return;
    }
    // Saved place without coordinates: geocode its address once.
    setResolvingId(p.id);
    try {
      const [hit] = await searchPlaces(p.address || p.name, near);
      if (!hit) {
        setError(`Couldn’t find “${p.name}” on the map. Search for it instead.`);
        return;
      }
      onSelect({ ...hit, id: p.id, name: p.name, type: p.type });
      setText(p.name);
      setOpen(false);
    } catch {
      setError('Couldn’t locate that saved place. Check your connection and try again.');
    } finally {
      setResolvingId(null);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && options[active]) {
      e.preventDefault();
      void choose(options[active]!);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setText(value?.name ?? '');
      inputRef.current?.blur();
    }
  };

  let lastGroup = '';
  return (
    <div ref={wrapRef} className="relative">
      <label className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-[#E31E24] focus-within:bg-white transition-colors">
        <span
          className={`w-2.5 h-2.5 shrink-0 ${accent === 'pickup' ? 'rounded-full bg-green-600' : 'rounded-sm bg-[#E31E24]'}`}
          aria-hidden="true"
        />
        <span className="sr-only">{label}</span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          value={text}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onFocus={(e) => {
            setOpen(true);
            e.currentTarget.select();
          }}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none placeholder-gray-400"
        />
        {(loading || locating) && <Spinner className="w-4 h-4 text-gray-400" />}
        {!loading && text && onClear && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => {
              setText('');
              onClear();
              inputRef.current?.focus();
            }}
            className="text-gray-400 hover:text-gray-700 text-xs font-bold px-1"
          >
            ✕
          </button>
        )}
      </label>

      {open && (options.length > 0 || error) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[1000] mt-1 w-full max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl py-1"
        >
          {options.map((opt, i) => {
            const group = opt.kind === 'current' ? '' : opt.group;
            const header = group && group !== lastGroup ? group : '';
            lastGroup = group || lastGroup;
            return (
              <React.Fragment key={opt.kind === 'current' ? 'current' : `${opt.group}-${opt.place.id}`}>
                {header && header !== 'Results' && (
                  <li className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400" role="presentation">
                    {header}
                  </li>
                )}
                <li
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => void choose(opt)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${i === active ? 'bg-red-50' : ''}`}
                >
                  {opt.kind === 'current' ? (
                    <>
                      <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm">◎</span>
                      <span className="text-sm font-semibold text-blue-700">Use my current location</span>
                    </>
                  ) : (
                    <>
                      <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs shrink-0">
                        {resolvingId === opt.place.id ? <Spinner className="w-3 h-3" /> : TYPE_ICON[opt.place.type] ?? '📍'}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-gray-900 truncate">{opt.place.name}</span>
                        <span className="block text-[11px] text-gray-500 truncate">{opt.place.address}</span>
                      </span>
                    </>
                  )}
                </li>
              </React.Fragment>
            );
          })}
          {error && <li className="px-3 py-2.5 text-xs text-gray-500">{error}</li>}
        </ul>
      )}
    </div>
  );
};

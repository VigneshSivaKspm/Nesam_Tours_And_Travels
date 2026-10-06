import { useMemo } from "react";

interface Props {
  /** Local "YYYY-MM-DDTHH:mm", or "" for no value. */
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  id?: string;
  /** Earliest selectable date, "YYYY-MM-DD". */
  min?: string;
  hasError?: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/**
 * Date and time with an explicit 12-hour clock (hour, minute, AM/PM). The
 * browser's own time field follows the computer's locale and can show 24-hour
 * time, so this always shows "06:30 PM". The value stays a local datetime string.
 */
export default function DateTime12Input({ value, onChange, disabled, id, min, hasError }: Props) {
  const parts = useMemo(() => {
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!m) return { date: "", hour12: 12, minute: 0, pm: false, hasTime: false };
    const h = Number(m[2]);
    return { date: m[1], hour12: h % 12 === 0 ? 12 : h % 12, minute: Number(m[3]), pm: h >= 12, hasTime: true };
  }, [value]);

  const emit = (date: string, hour12: number, minute: number, pm: boolean) => {
    if (!date) return onChange("");
    const h24 = (hour12 % 12) + (pm ? 12 : 0);
    onChange(`${date}T${pad(h24)}:${pad(minute)}`);
  };

  const base = `px-2.5 py-2.5 border rounded-lg text-sm bg-white text-[#111] focus:border-[#E21B23] focus:outline-none disabled:bg-gray-100 ${hasError ? "border-red-500" : "border-[#D4D4D4]"}`;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date and time">
      <input id={id} type="date" value={parts.date} min={min} disabled={disabled} onChange={(e) => emit(e.target.value, parts.hour12, parts.minute, parts.pm)} className={`${base} flex-1 min-w-[9.5rem]`} />
      <div className="flex items-center gap-1">
        <select aria-label="Hour" value={parts.hour12} disabled={disabled || !parts.date} onChange={(e) => emit(parts.date, Number(e.target.value), parts.minute, parts.pm)} className={base}>
          {HOURS.map((h) => (
            <option key={h} value={h}>{pad(h)}</option>
          ))}
        </select>
        <span className="font-bold text-[#555]">:</span>
        <select aria-label="Minute" value={parts.minute} disabled={disabled || !parts.date} onChange={(e) => emit(parts.date, parts.hour12, Number(e.target.value), parts.pm)} className={base}>
          {MINUTES.map((m) => (
            <option key={m} value={m}>{pad(m)}</option>
          ))}
        </select>
        <select aria-label="AM or PM" value={parts.pm ? "PM" : "AM"} disabled={disabled || !parts.date} onChange={(e) => emit(parts.date, parts.hour12, parts.minute, e.target.value === "PM")} className={`${base} font-semibold`}>
          <option>AM</option>
          <option>PM</option>
        </select>
      </div>
    </div>
  );
}

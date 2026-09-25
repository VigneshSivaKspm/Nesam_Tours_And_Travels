import React from 'react';
import { AlertCircle, Loader2, WifiOff } from 'lucide-react';

export const RED = '#E21B23';

const inputBase =
  'w-full px-3.5 py-2.5 text-[13px] bg-[#F5F5F5] border rounded-lg focus:outline-none focus:ring-1 transition-all placeholder-[#BBB] disabled:opacity-60 disabled:cursor-not-allowed';
const inputOk = 'border-[#E5E5E5] focus:border-[#E21B23] focus:ring-[#E21B23]/20';
const inputBad = 'border-[#F5A5A8] bg-[#FFF8F8] focus:border-[#E21B23] focus:ring-[#E21B23]/20';

interface FieldShellProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export const FieldShell: React.FC<FieldShellProps> = ({ label, htmlFor, required, error, hint, children }) => (
  <div>
    <label htmlFor={htmlFor} className="block text-[12px] font-semibold text-[#444] mb-1.5">
      {label}
      {required && <span className="text-[#E21B23]"> *</span>}
    </label>
    {children}
    {error ? (
      <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-[11px] font-medium text-[#E21B23]">
        {error}
      </p>
    ) : hint ? (
      <p className="mt-1 text-[11px] text-[#999]">{hint}</p>
    ) : null}
  </div>
);

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  prefix?: string;
}

export const TextField: React.FC<TextFieldProps> = ({ id, label, value, onChange, error, hint, prefix, required, ...rest }) => (
  <FieldShell label={label} htmlFor={id} required={required} error={error} hint={hint}>
    {prefix ? (
      <div
        className={`flex items-center border rounded-lg px-3.5 bg-[#F5F5F5] focus-within:ring-1 transition-all ${
          error ? 'border-[#F5A5A8] bg-[#FFF8F8]' : 'border-[#E5E5E5] focus-within:border-[#E21B23] focus-within:ring-[#E21B23]/20'
        }`}
      >
        <span className="text-[13px] font-bold text-[#E21B23] mr-2.5">{prefix}</span>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="bg-transparent w-full py-2.5 text-[13px] focus:outline-none placeholder-[#BBB]"
          {...rest}
        />
      </div>
    ) : (
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputBase} ${error ? inputBad : inputOk}`}
        {...rest}
      />
    )}
  </FieldShell>
);

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export const SelectField: React.FC<SelectFieldProps> = ({ id, label, value, onChange, options, placeholder, error, required, disabled }) => (
  <FieldShell label={label} htmlFor={id} required={required} error={error}>
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={!!error}
      className={`${inputBase} ${error ? inputBad : inputOk} ${value ? 'text-[#111]' : 'text-[#999]'}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </FieldShell>
);

export const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) =>
  message ? (
    <div role="alert" className="px-3.5 py-2.5 rounded-lg text-[12px] font-medium text-[#B4141B] bg-[#FEF2F2] border border-[#FBD5D5] flex items-start gap-2">
      <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-bold underline shrink-0">
          Retry
        </button>
      )}
    </div>
  ) : null;

export const OfflineBanner: React.FC = () => (
  <div className="px-3.5 py-2.5 rounded-lg text-[12px] font-medium text-amber-800 bg-amber-50 border border-amber-200 flex items-center gap-2">
    <WifiOff className="w-4 h-4 shrink-0" />
    You're offline. Changes can't be saved until your connection is back.
  </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ loading, variant = 'primary', disabled, children, className = '', ...rest }) => (
  <button
    type="button"
    disabled={disabled || loading}
    className={`px-5 py-2.5 text-[13px] font-semibold rounded-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 disabled:cursor-not-allowed ${
      variant === 'primary' ? 'text-white hover:opacity-90' : 'text-[#444] bg-white border border-[#E5E5E5] hover:bg-[#F5F5F5]'
    } ${className}`}
    style={variant === 'primary' ? { background: RED } : undefined}
    {...rest}
  >
    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
    {children}
  </button>
);

export const FullScreenLoader: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="h-screen w-screen flex flex-col items-center justify-center gap-3" style={{ background: '#F5F5F5' }}>
    <Loader2 className="w-6 h-6 animate-spin" style={{ color: RED }} />
    <span className="text-[12px] text-[#999] font-semibold uppercase tracking-wider">{label}</span>
  </div>
);

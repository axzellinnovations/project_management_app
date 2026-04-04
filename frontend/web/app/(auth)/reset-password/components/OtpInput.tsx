'use client';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function OtpInput({ value, onChange, disabled = false }: OtpInputProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">
        Reset Code (OTP)
      </label>
      <input
        type="text"
        maxLength={6}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm text-center tracking-widest font-mono disabled:bg-gray-100 disabled:cursor-not-allowed"
        placeholder="123456"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
      />
    </div>
  );
}

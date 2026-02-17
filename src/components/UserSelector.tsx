import React from 'react';

type Props = {
  value?: string | null;
  onChange: (userId: string | null) => void;
  orgId?: string;
  tenantId?: string;
  placeholder?: string;
};

// Minimal local selector to keep the MFE buildable/runnable.
// Can be replaced with a proper design-system component later.
export default function UserSelector({ value, onChange, placeholder = 'User ID' }: Props) {
  return (
    <input
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
    />
  );
}


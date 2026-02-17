import React from 'react';

type Props = {
  value: string;
  onChange: (id: string | null) => void;
  orgId?: string;
  tenantId?: string;
  placeholder?: string;
  className?: string;
  allowClear?: boolean;
};

// Minimal local selector to keep the MFE buildable/runnable.
// Can be replaced with a proper design-system component later.
export default function DepartmentSelector({
  value,
  onChange,
  placeholder = 'Department ID',
  className,
  allowClear,
}: Props) {
  return (
    <div className={className}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
      />
      {allowClear && value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="mt-1 text-xs text-slate-400 hover:text-white"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}


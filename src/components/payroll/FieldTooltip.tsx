import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Inline "?" tooltip for statutory / complex payroll fields. Every complex
 * field in payroll configuration must explain itself (spec UX rule) — e.g.
 * UAN: "Universal Account Number used for managing an employee's PF account."
 */
interface FieldTooltipProps {
    text: string;
}

const FieldTooltip: React.FC<FieldTooltipProps> = ({ text }) => {
    const [open, setOpen] = useState(false);
    return (
        <span className="relative inline-flex align-middle ml-1">
            <button
                type="button"
                aria-label={`Help: ${text}`}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onClick={() => setOpen(o => !o)}
                className="text-slate-500 hover:text-teal-400 transition-colors"
            >
                <HelpCircle size={13} />
            </button>
            {open && (
                <span
                    role="tooltip"
                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-[700] w-64 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 shadow-xl"
                >
                    {text}
                </span>
            )}
        </span>
    );
};

export default FieldTooltip;

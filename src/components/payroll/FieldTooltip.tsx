import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { IconButton } from '@so360/design-system';

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
        <span className="relative inline-flex align-middle ml-nb-1">
            <IconButton
                label={`Help: ${text}`}
                icon={<HelpCircle size={13} />}
                size="sm"
                hideTooltip
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onClick={() => setOpen(o => !o)}
            />
            {open && (
                <span
                    role="tooltip"
                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-nb-2 z-menu w-64 px-nb-3 py-nb-2 rounded-nb bg-surface-raised border border-line-strong text-nb-caption text-fg shadow-xl"
                >
                    {text}
                </span>
            )}
        </span>
    );
};

export default FieldTooltip;

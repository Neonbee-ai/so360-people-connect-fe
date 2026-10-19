import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';
import { IconButton } from '@so360/design-system';

/**
 * Inline toast.
 *
 * Most of this module reaches for `toast` from @so360/design-system, which is
 * imperative. This is the component form, for callers that hold the message in
 * their own state and render it declaratively.
 */
export type ToastType = 'success' | 'error';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    /** Auto-dismiss delay; pass 0 to require an explicit dismiss. */
    autoCloseMs?: number;
}

const STYLES: Record<ToastType, string> = {
    success: 'border-success bg-success-container text-success',
    error: 'border-danger bg-danger-container text-danger',
};

const Toast: React.FC<ToastProps> = ({ message, type, onClose, autoCloseMs = 4000 }) => {
    useEffect(() => {
        if (!autoCloseMs) return;
        const t = setTimeout(onClose, autoCloseMs);
        return () => clearTimeout(t);
    }, [autoCloseMs, onClose, message]);

    const Icon = type === 'success' ? CheckCircle : AlertTriangle;

    return (
        <div
            role="status"
            aria-live="polite"
            className={`fixed bottom-nb-6 right-nb-6 z-50 flex items-start gap-nb-2 rounded-nb border px-nb-4 py-nb-3 text-nb-sm shadow-lg ${STYLES[type]}`}
        >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <span className="max-w-xs">{message}</span>
            <IconButton label="Dismiss" size="sm" icon={<X size={14} />} onClick={onClose} />
        </div>
    );
};

export default Toast;

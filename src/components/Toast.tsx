import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    duration?: number;
}

const iconMap = {
    success: CheckCircle,
    error: XCircle,
    info: AlertCircle,
};

const styleMap = {
    success: 'border-emerald-500/30 bg-emerald-500/10',
    error: 'border-rose-500/30 bg-rose-500/10',
    info: 'border-blue-500/30 bg-blue-500/10',
};

const iconStyleMap = {
    success: 'text-emerald-400',
    error: 'text-rose-400',
    info: 'text-blue-400',
};

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 4000 }) => {
    const Icon = iconMap[type];

    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [onClose, duration]);

    return (
        <div className={`fixed bottom-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg border ${styleMap[type]} shadow-xl max-w-sm animate-in slide-in-from-right`}>
            <Icon size={18} className={iconStyleMap[type]} />
            <span className="text-sm text-white flex-1">{message}</span>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
                <X size={14} />
            </button>
        </div>
    );
};

export default Toast;

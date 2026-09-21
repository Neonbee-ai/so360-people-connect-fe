import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
    /**
     * Optional lower-emphasis alternative rendered beside `action`, for empty
     * states with two honest next steps (e.g. "use a standard template" vs
     * "build your own"). Ignored unless `action` is also set — a lone secondary
     * button would just be a primary one wearing the wrong style.
     */
    secondaryAction?: { label: string; onClick: () => void };
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, secondaryAction }) => {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
                <Icon size={24} className="text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-slate-300 mb-1">{title}</h3>
            <p className="text-sm text-slate-500 max-w-sm">{description}</p>
            {action && (
                <div className="mt-4 flex items-center gap-2">
                    <button
                        onClick={action.onClick}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        {action.label}
                    </button>
                    {secondaryAction && (
                        <button
                            onClick={secondaryAction.onClick}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors"
                        >
                            {secondaryAction.label}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default EmptyState;

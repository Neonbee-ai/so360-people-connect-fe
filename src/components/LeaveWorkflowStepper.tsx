import React from 'react';
import { CheckCircle, Circle, XCircle, Ban } from 'lucide-react';

const FORWARD_STATES = ['draft', 'submitted', 'approved'] as const;

const STATE_LABELS: Record<string, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    approved: 'Approved',
};

interface LeaveWorkflowStepperProps {
    status: string;
}

export const LeaveWorkflowStepper: React.FC<LeaveWorkflowStepperProps> = ({ status }) => {
    const normalized = status?.toLowerCase() || 'draft';
    // Map 'pending' to 'submitted' since the page uses both
    const mappedStatus = normalized === 'pending' ? 'submitted' : normalized;

    if (mappedStatus === 'rejected') {
        return (
            <div className="flex items-center gap-0">
                <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-500 text-white">
                        <CheckCircle className="w-4 h-4" />
                    </div>
                    <span className="text-xs mt-2 text-center w-16 text-teal-400">Draft</span>
                </div>
                <div className="flex-1 h-0.5 min-w-4 bg-teal-500" />
                <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-500 text-white">
                        <CheckCircle className="w-4 h-4" />
                    </div>
                    <span className="text-xs mt-2 text-center w-16 text-teal-400">Submitted</span>
                </div>
                <div className="flex-1 h-0.5 min-w-4 bg-red-500" />
                <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white">
                        <XCircle className="w-4 h-4" />
                    </div>
                    <span className="text-xs mt-2 text-center w-16 text-red-400">Rejected</span>
                </div>
            </div>
        );
    }

    if (mappedStatus === 'cancelled') {
        return (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                <Ban className="w-5 h-5 text-slate-500" />
                <span className="text-slate-500 font-medium text-sm">Cancelled</span>
            </div>
        );
    }

    const currentIndex = FORWARD_STATES.indexOf(mappedStatus as typeof FORWARD_STATES[number]);

    return (
        <div className="flex items-center gap-0">
            {FORWARD_STATES.map((state, index) => {
                const isCompleted = currentIndex > index;
                const isCurrent = currentIndex === index;
                const isLast = index === FORWARD_STATES.length - 1;
                const isPulse = isCurrent && state === 'submitted';

                return (
                    <React.Fragment key={state}>
                        <div className="flex flex-col items-center">
                            <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                                isCompleted ? 'bg-teal-500 text-white' :
                                isCurrent ? 'bg-teal-500/20 border-2 border-teal-500 text-teal-400' :
                                'bg-slate-800 border border-slate-600 text-slate-600'
                            }`}>
                                {isPulse && (
                                    <span className="absolute inset-0 rounded-full bg-teal-500/30 animate-ping" />
                                )}
                                {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            </div>
                            <span className={`text-xs mt-2 text-center w-16 ${
                                isCompleted || isCurrent ? 'text-teal-400' : 'text-slate-600'
                            }`}>
                                {STATE_LABELS[state]}
                            </span>
                        </div>
                        {!isLast && (
                            <div className={`flex-1 h-0.5 min-w-4 ${
                                isCompleted ? 'bg-teal-500' : 'bg-slate-700'
                            }`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default LeaveWorkflowStepper;

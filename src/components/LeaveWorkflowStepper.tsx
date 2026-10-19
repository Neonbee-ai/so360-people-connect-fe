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
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-fg">
                        <CheckCircle className="w-4 h-4" />
                    </div>
                    <span className="text-nb-caption mt-nb-2 text-center w-16 text-primary">Draft</span>
                </div>
                <div className="flex-1 h-0.5 min-w-4 bg-primary" />
                <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-fg">
                        <CheckCircle className="w-4 h-4" />
                    </div>
                    <span className="text-nb-caption mt-nb-2 text-center w-16 text-primary">Submitted</span>
                </div>
                <div className="flex-1 h-0.5 min-w-4 bg-danger" />
                <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-danger text-danger-fg">
                        <XCircle className="w-4 h-4" />
                    </div>
                    <span className="text-nb-caption mt-nb-2 text-center w-16 text-danger">Rejected</span>
                </div>
            </div>
        );
    }

    if (mappedStatus === 'cancelled') {
        return (
            <div className="flex items-center gap-nb-3 px-nb-4 py-nb-3 bg-line/30 rounded-nb border border-line-strong/30">
                <Ban className="w-5 h-5 text-fg-subtle" />
                <span className="text-fg-subtle text-nb-body">Cancelled</span>
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
                                isCompleted ? 'bg-primary text-primary-fg' :
                                isCurrent ? 'bg-primary/20 border-2 border-primary text-primary' :
                                'bg-surface-raised border border-line-strong text-fg-subtle'
                            }`}>
                                {isPulse && (
                                    <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                                )}
                                {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            </div>
                            <span className={`text-nb-caption mt-nb-2 text-center w-16 ${
                                isCompleted || isCurrent ? 'text-primary' : 'text-fg-subtle'
                            }`}>
                                {STATE_LABELS[state]}
                            </span>
                        </div>
                        {!isLast && (
                            <div className={`flex-1 h-0.5 min-w-4 ${
                                isCompleted ? 'bg-primary' : 'bg-line'
                            }`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default LeaveWorkflowStepper;

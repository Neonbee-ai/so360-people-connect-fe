import React, { useEffect, useState, useCallback } from 'react';
import { DollarSign, RefreshCw } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { toast, Select } from '@so360/design-system';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { leaveBalancesApi } from '../services/leaveRequestsService';
import type { LeaveBalance } from '../services/leaveRequestsService';
import { leaveTypesApi, LeaveType } from '../services/leaveTypesService';
import { peopleApi } from '../services/peopleService';
import type { Person } from '../types/people';

const currentYear = new Date().getFullYear();

const LeaveBalancesPage: React.FC = () => {
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:leave_balances:adjust') ?? true);

    const [people, setPeople] = useState<Person[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [personId, setPersonId] = useState('');
    const [fiscalYear, setFiscalYear] = useState(currentYear);
    const [balances, setBalances] = useState<LeaveBalance[]>([]);
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(false);
    const [adjustingType, setAdjustingType] = useState<LeaveType | null>(null);

    useEffect(() => {
        peopleApi.getAll({ status: 'active', limit: 200 }).then(result => setPeople(result.data)).catch(() => undefined);
        leaveTypesApi.getAll({ is_active: true }).then(result => setLeaveTypes(result.data)).catch(() => undefined);
    }, []);

    const loadBalances = useCallback(async () => {
        if (!personId) {
            setBalances([]);
            return;
        }
        try {
            setLoading(true);
            const result = await leaveBalancesApi.getAll({ person_id: personId, fiscal_year: fiscalYear });
            setBalances(result.data);
        } catch (error) {
            toast.error('Failed to load leave balances');
        } finally {
            setLoading(false);
        }
    }, [personId, fiscalYear]);

    useEffect(() => {
        loadBalances();
    }, [loadBalances]);

    const handleInitialize = async () => {
        if (!personId) return;
        try {
            setInitializing(true);
            await leaveBalancesApi.initialize({ person_id: personId, fiscal_year: fiscalYear });
            toast.success('Leave balances initialized successfully');
            recordActivity({ eventType: 'people.leave_balance.initialized', eventCategory: 'data', description: `Leave balances initialized for fiscal year ${fiscalYear}`, resourceType: 'leave_balance', resourceId: personId }).catch(() => {});
            await loadBalances();
        } catch (error) {
            toast.error('Failed to initialize leave balances');
        } finally {
            setInitializing(false);
        }
    };

    const handleAdjust = async (adjustment_amount: number, reason: string) => {
        if (!personId || !adjustingType) return;
        try {
            await leaveBalancesApi.adjust({
                person_id: personId,
                leave_type_id: adjustingType.id,
                fiscal_year: fiscalYear,
                adjustment_amount,
                reason,
            });
            toast.success(`${adjustingType.name} balance adjusted`);
            recordActivity({ eventType: 'people.leave_balance.adjusted', eventCategory: 'data', description: `${adjustingType.name} balance adjusted by ${adjustment_amount} days`, resourceType: 'leave_balance', resourceId: personId }).catch(() => {});
            setAdjustingType(null);
            await loadBalances();
        } catch (error) {
            toast.error('Failed to adjust leave balance');
        }
    };

    const balanceByType = new Map(balances.map(b => [b.leave_type_id, b]));
    const selectedPerson = people.find(p => p.id === personId);

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Leave Balances"
                subtitle="Initialize and adjust employee leave allocations"
            />

            <div className="bg-surface border border-line rounded-nb p-4 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[220px]">
                    <label className="block text-xs text-fg-muted mb-1">Employee</label>
                    <Select name="leavebalances-select-53" value={personId} onChange={(e) => setPersonId(e.target.value)} options={[{ value: "", label: "Select an employee..." }, ...people.map((p) => ({ value: p.id, label: p.full_name }))]} />
                </div>
                <div>
                    <label className="block text-xs text-fg-muted mb-1">Fiscal Year</label>
                    <input
                        type="number"
                        min={2020}
                        max={2100}
                        value={fiscalYear}
                        onChange={(e) => setFiscalYear(parseInt(e.target.value, 10) || currentYear)}
                        className="w-28 px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                    />
                </div>
                {canManage && (
                    <button
                        onClick={handleInitialize}
                        disabled={!personId || initializing}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary-fg text-sm font-medium rounded-nb transition-colors"
                    >
                        <RefreshCw size={16} />
                        {initializing ? 'Initializing...' : 'Initialize Balances'}
                    </button>
                )}
            </div>

            {!personId ? (
                <EmptyState
                    icon={DollarSign}
                    title="Select an employee"
                    description="Choose an employee above to view or initialize their leave balances."
                />
            ) : loading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-14 bg-surface-raised/50 rounded-nb animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="bg-surface border border-line rounded-nb overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-surface-raised/50 border-b border-line">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Leave Type</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Opening</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Accrued</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Adjusted</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Used</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Pending</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Available</th>
                                {canManage && <th className="px-4 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {leaveTypes.map(type => {
                                const balance = balanceByType.get(type.id);
                                return (
                                    <tr key={type.id} className="hover:bg-surface-raised/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {type.color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />}
                                                <span className="text-sm font-medium text-fg">{type.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-fg-muted">{balance ? balance.opening_balance : '-'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-fg-muted">{balance ? balance.accrued : '-'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-fg-muted">{balance ? balance.adjusted : '-'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-fg-muted">{balance ? balance.used : '-'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-fg-muted">{balance ? balance.pending : '-'}</td>
                                        <td className="px-4 py-3 text-center text-sm font-medium text-primary">{balance ? balance.available : 'Not initialized'}</td>
                                        {canManage && (
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => setAdjustingType(type)}
                                                    disabled={!balance}
                                                    className="text-xs text-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    Adjust
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <AdjustBalanceModal
                isOpen={!!adjustingType}
                leaveTypeName={adjustingType?.name || ''}
                personName={selectedPerson?.full_name || ''}
                onClose={() => setAdjustingType(null)}
                onSubmit={handleAdjust}
            />

        </div>
    );
};

// =============================================================================
// Adjust Balance Modal
// =============================================================================

interface AdjustBalanceModalProps {
    isOpen: boolean;
    leaveTypeName: string;
    personName: string;
    onClose: () => void;
    onSubmit: (adjustment_amount: number, reason: string) => void;
}

const AdjustBalanceModal: React.FC<AdjustBalanceModalProps> = ({ isOpen, leaveTypeName, personName, onClose, onSubmit }) => {
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (isOpen) {
            setAmount('');
            setReason('');
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = parseFloat(amount);
        if (Number.isNaN(parsed) || parsed === 0) return;
        onSubmit(parsed, reason);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Adjust ${leaveTypeName} Balance`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-fg-muted">Adjusting balance for <span className="text-fg">{personName}</span></p>
                <div>
                    <label className="block text-xs text-fg-muted mb-1">Adjustment (days) *</label>
                    <input
                        type="number"
                        step="0.5"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="e.g. 5 to add, -2 to deduct"
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                    />
                </div>
                <div>
                    <label className="block text-xs text-fg-muted mb-1">Reason</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        placeholder="e.g. Bonus leave for project completion"
                    />
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-line">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">
                        Cancel
                    </button>
                    <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors">
                        Adjust
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default LeaveBalancesPage;

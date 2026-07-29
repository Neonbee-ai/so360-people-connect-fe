import React, { useEffect, useState, useCallback } from 'react';
import { DollarSign, RefreshCw } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
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
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

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
            setToast({ message: 'Failed to load leave balances', type: 'error' });
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
            setToast({ message: 'Leave balances initialized successfully', type: 'success' });
            recordActivity({ eventType: 'people.leave_balance.initialized', eventCategory: 'data', description: `Leave balances initialized for fiscal year ${fiscalYear}`, resourceType: 'leave_balance', resourceId: personId }).catch(() => {});
            await loadBalances();
        } catch (error) {
            setToast({ message: 'Failed to initialize leave balances', type: 'error' });
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
            setToast({ message: `${adjustingType.name} balance adjusted`, type: 'success' });
            recordActivity({ eventType: 'people.leave_balance.adjusted', eventCategory: 'data', description: `${adjustingType.name} balance adjusted by ${adjustment_amount} days`, resourceType: 'leave_balance', resourceId: personId }).catch(() => {});
            setAdjustingType(null);
            await loadBalances();
        } catch (error) {
            setToast({ message: 'Failed to adjust leave balance', type: 'error' });
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

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[220px]">
                    <label className="block text-xs text-slate-400 mb-1">Employee</label>
                    <select
                        value={personId}
                        onChange={(e) => setPersonId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                    >
                        <option value="">Select an employee...</option>
                        {people.map(p => (
                            <option key={p.id} value={p.id}>{p.full_name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Fiscal Year</label>
                    <input
                        type="number"
                        min={2020}
                        max={2100}
                        value={fiscalYear}
                        onChange={(e) => setFiscalYear(parseInt(e.target.value, 10) || currentYear)}
                        className="w-28 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                    />
                </div>
                {canManage && (
                    <button
                        onClick={handleInitialize}
                        disabled={!personId || initializing}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
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
                        <div key={i} className="h-14 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Leave Type</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Opening</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Accrued</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Adjusted</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Used</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Pending</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Available</th>
                                {canManage && <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {leaveTypes.map(type => {
                                const balance = balanceByType.get(type.id);
                                return (
                                    <tr key={type.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {type.color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />}
                                                <span className="text-sm font-medium text-slate-50">{type.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-slate-400">{balance ? balance.opening_balance : '-'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-slate-400">{balance ? balance.accrued : '-'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-slate-400">{balance ? balance.adjusted : '-'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-slate-400">{balance ? balance.used : '-'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-slate-400">{balance ? balance.pending : '-'}</td>
                                        <td className="px-4 py-3 text-center text-sm font-medium text-teal-400">{balance ? balance.available : 'Not initialized'}</td>
                                        {canManage && (
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => setAdjustingType(type)}
                                                    disabled={!balance}
                                                    className="text-xs text-teal-400 hover:text-teal-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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
                <p className="text-sm text-slate-400">Adjusting balance for <span className="text-slate-200">{personName}</span></p>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Adjustment (days) *</label>
                    <input
                        type="number"
                        step="0.5"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="e.g. 5 to add, -2 to deduct"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Reason</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        placeholder="e.g. Bonus leave for project completion"
                    />
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">
                        Adjust
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default LeaveBalancesPage;

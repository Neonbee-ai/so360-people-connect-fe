import React, { useEffect, useState, useCallback } from 'react';
import { DollarSign, RefreshCw } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { toast, Select, Button, ListPageTemplate, DataTable, Modal, NumberInput, Textarea, Stack, Cluster } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
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

    const columns: DataTableColumn<LeaveType>[] = [
        {
            key: 'name',
            header: 'Leave Type',
            render: (type) => (
                <Cluster gap="tight" align="center">
                    {type.color && <span className="w-nb-3 h-nb-3 shrink-0 rounded-full" style={{ backgroundColor: type.color }} />}
                    <span className="min-w-0 break-words text-nb-body font-medium text-fg">{type.name}</span>
                </Cluster>
            ),
        },
        { key: 'opening', header: 'Opening', align: 'center', render: (t) => { const b = balanceByType.get(t.id); return b ? b.opening_balance : '-'; } },
        { key: 'accrued', header: 'Accrued', align: 'center', render: (t) => { const b = balanceByType.get(t.id); return b ? b.accrued : '-'; } },
        { key: 'adjusted', header: 'Adjusted', align: 'center', render: (t) => { const b = balanceByType.get(t.id); return b ? b.adjusted : '-'; } },
        { key: 'used', header: 'Used', align: 'center', render: (t) => { const b = balanceByType.get(t.id); return b ? b.used : '-'; } },
        { key: 'pending', header: 'Pending', align: 'center', render: (t) => { const b = balanceByType.get(t.id); return b ? b.pending : '-'; } },
        {
            key: 'available',
            header: 'Available',
            align: 'center',
            render: (t) => { const b = balanceByType.get(t.id); return <span className="font-medium text-primary">{b ? b.available : 'Not initialized'}</span>; },
        },
    ];

    return (
        <ListPageTemplate trail={[]}
            title="Leave Balances"
            description="Initialize and adjust employee leave allocations"
            loading={!!personId && loading}
            isEmpty={!personId}
            empty={
                <EmptyState
                    icon={DollarSign}
                    title="Select an employee"
                    description="Choose an employee above to view or initialize their leave balances."
                />
            }
            toolbarEnd={
                <Cluster gap="default" align="end">
                    <Select
                        name="leavebalances-select-53"
                        label="Employee"
                        value={personId}
                        onChange={(e) => setPersonId(e.target.value)}
                        options={[{ value: '', label: 'Select an employee...' }, ...people.map((p) => ({ value: p.id, label: p.full_name }))]}
                    />
                    <NumberInput
                        name="leavebalances-fiscal-year"
                        label="Fiscal Year"
                        min={2020}
                        max={2100}
                        value={fiscalYear}
                        onChange={(v) => setFiscalYear(v || currentYear)}
                    />
                    {canManage && (
                        <Button
                            variant="primary"
                            onClick={handleInitialize}
                            disabled={!personId || initializing}
                            leadingIcon={<RefreshCw size={16} />}
                        >
                            {initializing ? 'Initializing...' : 'Initialize Balances'}
                        </Button>
                    )}
                </Cluster>
            }
        >
            <div className="min-w-0 max-w-full overflow-x-auto">
            <DataTable
                name="leave-balances"
                columns={columns}
                rows={leaveTypes}
                rowKey={(t) => t.id}
                rowActions={canManage ? (t) => [{ label: 'Adjust', onSelect: () => setAdjustingType(t), disabled: !balanceByType.get(t.id) }] : undefined}
            />
            </div>

            <AdjustBalanceModal
                isOpen={!!adjustingType}
                leaveTypeName={adjustingType?.name || ''}
                personName={selectedPerson?.full_name || ''}
                onClose={() => setAdjustingType(null)}
                onSubmit={handleAdjust}
            />
        </ListPageTemplate>
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
        <Modal
            open={isOpen}
            onClose={onClose}
            title={`Adjust ${leaveTypeName} Balance`}
            footer={
                <Cluster gap="default" justify="end">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="adjust-balance-form" variant="primary">Adjust</Button>
                </Cluster>
            }
        >
            <form id="adjust-balance-form" onSubmit={handleSubmit}>
                <Stack gap="default">
                    <p className="text-nb-body text-fg-muted">Adjusting balance for <span className="text-fg">{personName}</span></p>
                    <NumberInput
                        name="adjust-amount"
                        label="Adjustment (days) *"
                        step={0.5}
                        required
                        value={amount === '' ? null : Number(amount)}
                        onChange={(v) => setAmount(v === null ? '' : String(v))}
                        placeholder="e.g. 5 to add, -2 to deduct"
                    />
                    <Textarea
                        name="adjust-reason"
                        label="Reason"
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Bonus leave for project completion"
                    />
                </Stack>
            </form>
        </Modal>
    );
};

export default LeaveBalancesPage;

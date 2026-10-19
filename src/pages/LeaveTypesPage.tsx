import React, { useEffect, useState, useCallback } from 'react';
import { CalendarClock } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import {
    toast, Select, Button, ListPageTemplate, DataTable, Modal, TextField, Textarea, Checkbox, NumberInput,
    ColorPicker, FormSection, Stack, Cluster,
} from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { leaveTypesApi, LeaveType, CreateLeaveTypePayload } from '../services/leaveTypesService';

const LeaveTypesPage: React.FC = () => {
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreate = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:leave_types:create') ?? true);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);

    const loadLeaveTypes = useCallback(async () => {
        try {
            setLoading(true);
            const result = await leaveTypesApi.getAll();
            setLeaveTypes(result.data);
        } catch (error) {
            console.error('Failed to load leave types:', error);
            toast.error('Failed to load leave types');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLeaveTypes();
    }, [loadLeaveTypes]);

    const handleCreate = async (data: CreateLeaveTypePayload) => {
        try {
            const created = await leaveTypesApi.create(data);
            setShowCreateModal(false);
            toast.success(`Leave type ${data.name} has been created`);
            recordActivity({ eventType: 'people.leave_type.created', eventCategory: 'data', description: `Leave type ${data.name} was created`, resourceType: 'leave_type', resourceId: created?.id }).catch(() => {});
            loadLeaveTypes();
        } catch (error) {
            toast.error('Failed to create leave type');
        }
    };

    const handleUpdate = async (id: string, data: Partial<LeaveType>) => {
        try {
            await leaveTypesApi.update(id, data);
            setEditingLeaveType(null);
            toast.success('Leave type updated successfully');
            recordActivity({ eventType: 'people.leave_type.updated', eventCategory: 'data', description: `Leave type ${data.name || id} was updated`, resourceType: 'leave_type', resourceId: id }).catch(() => {});
            loadLeaveTypes();
        } catch (error) {
            toast.error('Failed to update leave type');
        }
    };

    /*
     * Rows are not navigation targets: the row-actions menu owns editing. A
     * row-wide click plus a dedicated Edit action were two ways to do the same
     * thing, and the row swallowed clicks meant only to read a value.
     */
    const columns: DataTableColumn<LeaveType>[] = [
        {
            key: 'name',
            header: 'Name',
            render: (lt) => (
                <Cluster gap="tight" align="center">
                    {lt.color && <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: lt.color }} />}
                    <span className="text-nb-body text-fg">{lt.name}</span>
                </Cluster>
            ),
        },
        { key: 'code', header: 'Code', render: (lt) => <span className="text-fg-muted">{lt.code}</span> },
        { key: 'is_paid', header: 'Paid', align: 'center', render: (lt) => <StatusBadge status={lt.is_paid ? 'paid' : 'unpaid'} /> },
        { key: 'requires_approval', header: 'Approval', align: 'center', render: (lt) => <StatusBadge status={lt.requires_approval ? 'required' : 'not_required'} /> },
        { key: 'accrual_type', header: 'Accrual', render: (lt) => <span className="capitalize text-fg-muted">{lt.accrual_type}</span> },
        { key: 'max_days_per_year', header: 'Max Days/Year', align: 'center', hideBelow: 'medium', render: (lt) => <span className="text-fg-muted">{lt.max_days_per_year || '-'}</span> },
        { key: 'carry_forward_allowed', header: 'Carry Forward', align: 'center', hideBelow: 'expanded', render: (lt) => <StatusBadge status={lt.carry_forward_allowed ? 'allowed' : 'not_allowed'} /> },
        { key: 'is_active', header: 'Status', align: 'center', render: (lt) => <StatusBadge status={lt.is_active ? 'active' : 'inactive'} /> },
    ];

    return (
        <>
            <ListPageTemplate
                title="Leave Types"
                description="Configure leave policies and accrual rules"
                loading={loading}
                isEmpty={leaveTypes.length === 0}
                primaryAction={canCreate ? (
                    <Button onClick={() => setShowCreateModal(true)}>
                        <CalendarClock size={16} />
                        Create Leave Type
                    </Button>
                ) : undefined}
                empty={
                    <EmptyState
                        icon={CalendarClock}
                        title="No leave types found"
                        description="Create leave types to manage employee time off."
                        action={canCreate ? { label: 'Create Leave Type', onClick: () => setShowCreateModal(true) } : undefined}
                    />
                }
            >
                <DataTable
                    name="leave-types"
                    columns={columns}
                    rows={leaveTypes}
                    rowKey={(lt) => lt.id}
                    rowActions={canCreate ? (lt) => [{ label: 'Edit', onSelect: () => setEditingLeaveType(lt) }] : undefined}
                />
            </ListPageTemplate>

            <LeaveTypeModal
                isOpen={showCreateModal || !!editingLeaveType}
                onClose={() => {
                    setShowCreateModal(false);
                    setEditingLeaveType(null);
                }}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
                leaveType={editingLeaveType}
            />
        </>
    );
};

// =============================================================================
// Leave Type Modal
// =============================================================================

interface LeaveTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateLeaveTypePayload) => void;
    onUpdate: (id: string, data: Partial<LeaveType>) => void;
    leaveType: LeaveType | null;
}

const LeaveTypeModal: React.FC<LeaveTypeModalProps> = ({ isOpen, onClose, onCreate, onUpdate, leaveType }) => {
    const [formData, setFormData] = useState<CreateLeaveTypePayload>({
        code: '',
        name: '',
        description: '',
        is_paid: true,
        requires_approval: true,
        requires_documentation: false,
        accrual_type: 'annual',
        max_days_per_year: 20,
        accrual_rate: 1.67,
        carry_forward_allowed: false,
        max_carry_forward_days: 0,
        notice_period_days: 0,
        color: '#10b981',
        is_active: true,
    });

    useEffect(() => {
        if (leaveType) {
            setFormData({
                code: leaveType.code,
                name: leaveType.name,
                description: leaveType.description || '',
                is_paid: leaveType.is_paid,
                requires_approval: leaveType.requires_approval,
                requires_documentation: leaveType.requires_documentation,
                accrual_type: leaveType.accrual_type,
                max_days_per_year: leaveType.max_days_per_year,
                accrual_rate: leaveType.accrual_rate,
                carry_forward_allowed: leaveType.carry_forward_allowed,
                max_carry_forward_days: leaveType.max_carry_forward_days,
                notice_period_days: leaveType.notice_period_days,
                color: leaveType.color,
                is_active: leaveType.is_active,
            });
        }
    }, [leaveType]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code || !formData.name) return;

        if (leaveType) {
            onUpdate(leaveType.id, formData);
        } else {
            onCreate(formData);
        }
    };

    const updateField = (field: keyof CreateLeaveTypePayload, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={leaveType ? 'Edit Leave Type' : 'Create Leave Type'}
            size="lg"
            footer={
                <Cluster gap="default" justify="end">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="leave-type-form">{leaveType ? 'Update' : 'Create'}</Button>
                </Cluster>
            }
        >
            <form id="leave-type-form" onSubmit={handleSubmit}>
                <Stack gap="region">
                    <FormSection title="Basic Information" variant="plain" columns={2}>
                            <TextField
                                name="leave-type-code"
                                label="Code"
                                required
                                value={formData.code}
                                onChange={(e) => updateField('code', e.target.value)}
                                placeholder="AL"
                            />
                            <TextField
                                name="leave-type-name"
                                label="Name"
                                required
                                value={formData.name}
                                onChange={(e) => updateField('name', e.target.value)}
                                placeholder="Annual Leave"
                            />
                            <Textarea
                                name="leave-type-description"
                                label="Description"
                                rows={2}
                                value={formData.description || ''}
                                onChange={(e) => updateField('description', e.target.value)}
                            />
                            <ColorPicker
                                name="leave-type-color"
                                label="Color"
                                value={formData.color || '#10b981'}
                                onChange={(v) => updateField('color', v)}
                            />
                    </FormSection>

                    <FormSection title="Policies" variant="plain">
                        <Stack gap="tight">
                            <Checkbox name="leave-type-is-paid" label="Paid Leave" checked={formData.is_paid} onChange={(e) => updateField('is_paid', e.target.checked)} />
                            <Checkbox name="leave-type-requires-approval" label="Requires Approval" checked={formData.requires_approval} onChange={(e) => updateField('requires_approval', e.target.checked)} />
                            <Checkbox name="leave-type-requires-documentation" label="Requires Documentation" checked={formData.requires_documentation} onChange={(e) => updateField('requires_documentation', e.target.checked)} />
                            <Checkbox name="leave-type-carry-forward" label="Allow Carry Forward" checked={formData.carry_forward_allowed} onChange={(e) => updateField('carry_forward_allowed', e.target.checked)} />
                            <Checkbox name="leave-type-is-active" label="Active" checked={formData.is_active} onChange={(e) => updateField('is_active', e.target.checked)} />
                        </Stack>
                    </FormSection>

                    <FormSection title="Accrual & Limits" variant="plain" columns={2}>
                            <Select
                                name="leavetypes-select-57"
                                label="Accrual Type"
                                value={formData.accrual_type}
                                onChange={(e) => updateField('accrual_type', e.target.value)}
                                options={[{ value: 'annual', label: 'Annual' }, { value: 'monthly', label: 'Monthly' }, { value: 'none', label: 'None' }]}
                            />
                            <NumberInput
                                name="leave-type-max-days"
                                label="Max Days Per Year"
                                min={0}
                                step={0.5}
                                value={formData.max_days_per_year || null}
                                onChange={(v) => updateField('max_days_per_year', v || undefined)}
                            />
                            <NumberInput
                                name="leave-type-accrual-rate"
                                label="Accrual Rate (days/month)"
                                min={0}
                                step={0.01}
                                value={formData.accrual_rate || null}
                                onChange={(v) => updateField('accrual_rate', v || undefined)}
                            />
                            <NumberInput
                                name="leave-type-max-carry"
                                label="Max Carry Forward Days"
                                min={0}
                                step={0.5}
                                value={formData.max_carry_forward_days || null}
                                onChange={(v) => updateField('max_carry_forward_days', v || undefined)}
                            />
                            <NumberInput
                                name="leave-type-notice"
                                label="Notice Period (days)"
                                min={0}
                                value={formData.notice_period_days || null}
                                onChange={(v) => updateField('notice_period_days', v ? Math.trunc(v) : undefined)}
                            />
                    </FormSection>
                </Stack>
            </form>
        </Modal>
    );
};

export default LeaveTypesPage;

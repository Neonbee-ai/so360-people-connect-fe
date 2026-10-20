import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Plus, Edit2, XCircle } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { toast, useConfirm, Select, Button, ListPageTemplate, DataTable, Avatar, Progress, Modal, DateInput, TextField, Textarea, Banner, Stack, Cluster } from '@so360/design-system';
import type { DataTableColumn, FilterValues, ListFilterConfig } from '@so360/design-system';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { allocationsApi, peopleApi } from '../services/peopleService';
import { departmentsApi, Department } from '../services/departmentsService';
import { isUuid } from '../utils/validation';
import EntitySelector from '../components/EntitySelector';
import { usePeopleFormatters } from '../utils/formatters';
import { useCanViewCompensation } from '../hooks/useCanViewCompensation';
import type { Allocation, CreateAllocationPayload, UpdateAllocationPayload, Person, AllocationStatus, EntityOption, LookupEntityType } from '../types/people';

interface FlatDepartment extends Department {
    depth: number;
}

const flattenDepartmentTree = (nodes: Department[], depth = 0): FlatDepartment[] => {
    const result: FlatDepartment[] = [];
    for (const node of nodes) {
        result.push({ ...node, depth });
        if (node.children?.length) result.push(...flattenDepartmentTree(node.children, depth + 1));
    }
    return result;
};

const AllocationsPage: React.FC = () => {
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreateAllocation = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:allocations:create') ?? true);
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
    const [departmentFilter, setDepartmentFilter] = useState<string>('');
    const [departments, setDepartments] = useState<FlatDepartment[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);

    const loadAllocations = useCallback(async () => {
        try {
            setLoading(true);
            const result = await allocationsApi.getAll({
                status: statusFilter || undefined,
                entity_type: entityTypeFilter || undefined,
                department_id: departmentFilter || undefined,
            });
            setAllocations(result.data);
        } catch (error) {
            console.error('Failed to load allocations:', error);
            toast.error('Failed to load allocations');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, entityTypeFilter, departmentFilter]);

    useEffect(() => {
        loadAllocations();
    }, [loadAllocations]);

    useEffect(() => {
        departmentsApi.getTree()
            .then(res => setDepartments(flattenDepartmentTree(res.data)))
            .catch(() => setDepartments([]));
    }, []);

    const handleCreate = async (data: CreateAllocationPayload) => {
        const created = await allocationsApi.create(data);
        setShowCreateModal(false);
        toast.success('Allocation created successfully');
        recordActivity({ eventType: 'people.allocation.created', eventCategory: 'data', description: `Allocation created for ${data.entity_name || data.entity_id}`, resourceType: 'allocation', resourceId: created?.id }).catch(() => {});
        loadAllocations();
    };

    const handleUpdate = async (id: string, data: UpdateAllocationPayload) => {
        await allocationsApi.update(id, data);
        setEditingAllocation(null);
        toast.success('Allocation updated');
        recordActivity({ eventType: 'people.allocation.updated', eventCategory: 'data', description: `Allocation ${id} was updated`, resourceType: 'allocation', resourceId: id }).catch(() => {});
        loadAllocations();
    };

    const [confirm, confirmDialog] = useConfirm();

    const handleCancel = async (id: string) => {
        if (!(await confirm({ title: 'Cancel allocation', message: 'Cancel this allocation? This action cannot be undone.', intent: 'danger', confirmLabel: 'Cancel allocation' }))) return;
        try {
            await allocationsApi.cancel(id);
            toast.success('Allocation cancelled');
            loadAllocations();
        } catch (error) {
            toast.error('Failed to cancel allocation');
        }
    };

    // Group allocations by person for summary view
    const allocationsByPerson = allocations.reduce<Record<string, { person: Allocation['person']; allocations: Allocation[]; totalPct: number }>>((acc, alloc) => {
        const personId = alloc.person_id;
        if (!acc[personId]) {
            acc[personId] = {
                person: alloc.person,
                allocations: [],
                totalPct: 0,
            };
        }
        acc[personId].allocations.push(alloc);
        if (alloc.status === 'active') {
            acc[personId].totalPct += alloc.allocation_value ?? 0;
        }
        return acc;
    }, {});

    const deptOptions = [
        { value: '', label: 'All Departments' },
        ...departments.map(dept => ({
            value: dept.id,
            label: `${dept.depth > 0 ? `${'  '.repeat(dept.depth)}└ ` : ''}${dept.name}`,
        })),
    ];

    const filterValues: FilterValues = {
        status: statusFilter || null,
        entity_type: entityTypeFilter || null,
        department_id: departmentFilter || null,
    };
    const filterConfig: ListFilterConfig = {
        fields: [
            { key: 'status', label: 'Status', type: 'select', options: [{ value: 'planned', label: 'Planned' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }] },
            { key: 'entity_type', label: 'Entity type', type: 'select', options: [{ value: 'project', label: 'Project' }, { value: 'task', label: 'Task' }, { value: 'lead', label: 'Lead' }, { value: 'customer', label: 'Customer' }, { value: 'opportunity', label: 'Opportunity' }, { value: 'department', label: 'Department' }] },
            { key: 'department_id', label: 'Department', type: 'select', options: deptOptions.filter(o => o.value) },
        ],
        values: filterValues,
        onChange: (v) => {
            setStatusFilter(typeof v.status === 'string' ? v.status : '');
            setEntityTypeFilter(typeof v.entity_type === 'string' ? v.entity_type : '');
            setDepartmentFilter(typeof v.department_id === 'string' ? v.department_id : '');
        },
        onClear: () => { setStatusFilter(''); setEntityTypeFilter(''); setDepartmentFilter(''); },
    };

    const columns: DataTableColumn<Allocation>[] = [
        {
            key: 'person',
            header: 'Person',
            sortable: true,
            sortValue: (a) => a.person?.full_name ?? '',
            render: (a) => (
                <Cluster gap="tight" className="flex-nowrap">
                    <Avatar name={a.person?.full_name || 'Unknown Person'} size="sm" />
                    <span className="min-w-0 truncate text-nb-sm font-medium text-fg">{a.person?.full_name || 'Unknown Person'}</span>
                </Cluster>
            ),
        },
        {
            key: 'entity',
            header: 'Project / entity',
            sortable: true,
            sortValue: (a) => a.entity_name || a.entity_id,
            render: (a) => (
                <Stack gap="none">
                    <span className="truncate text-nb-sm text-fg">{a.entity_name || a.entity_id}</span>
                    <span className="truncate text-nb-xs capitalize text-fg-muted">{a.entity_type}</span>
                </Stack>
            ),
        },
        {
            key: 'allocation_value',
            header: 'Allocation',
            align: 'right',
            sortable: true,
            sortValue: (a) => a.allocation_value ?? 0,
            render: (a) => {
                const personData = allocationsByPerson[a.person_id];
                const over = a.status === 'active' && !!personData && personData.totalPct > 100;
                return (
                    <Stack gap="none">
                        <span className="tabular-nums text-nb-sm font-medium text-fg">{a.allocation_value}%</span>
                        {over && <span className="tabular-nums text-nb-xs text-warning">Total: {personData.totalPct}%</span>}
                    </Stack>
                );
            },
        },
        { key: 'status', header: 'Status', sortable: true, sortValue: (a) => a.status, render: (a) => <StatusBadge status={a.status} /> },
        {
            key: 'period',
            header: 'Period',
            sortable: true,
            sortValue: (a) => a.start_date,
            render: (a) => <span className="whitespace-nowrap text-nb-sm text-fg-muted">{a.start_date} to {a.end_date}</span>,
        },
        {
            key: 'progress',
            header: 'Capacity',
            hideBelow: 'medium',
            widthClassName: 'w-40',
            render: (a) => a.status === 'active'
                ? <Progress value={Math.min(a.allocation_value ?? 0, 100)} size="sm" tone={(a.allocation_value ?? 0) > 80 ? 'warning' : 'brand'} label={`Capacity ${a.allocation_value ?? 0}%`} />
                : <span className="text-fg-muted">—</span>,
        },
    ];

    return (
        <>
            {confirmDialog}
            <ListPageTemplate
                title="Allocations"
                description="Assign people to execution entities with capacity control"
                count={allocations.length}
                primaryAction={canCreateAllocation ? (
                    <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                        <Plus size={16} />
                        New Allocation
                    </Button>
                ) : undefined}
                loading={loading}
                isEmpty={allocations.length === 0 && !statusFilter && !entityTypeFilter && !departmentFilter}
                isFilteredEmpty={allocations.length === 0 && !!(statusFilter || entityTypeFilter || departmentFilter)}
                onClearFilters={filterConfig.onClear}
                empty={(
                    <EmptyState
                        icon={Target}
                        title="No allocations"
                        description="Create allocations to assign people to projects, tasks, or other execution entities."
                        action={{ label: 'Create Allocation', onClick: () => setShowCreateModal(true) }}
                    />
                )}
                filterConfig={filterConfig}
            >
                <DataTable
                    name="allocations"
                    columns={columns}
                    rows={allocations}
                    rowKey={(a) => a.id}
                    onRowClick={(a) => navigate(`/people/people/${a.person_id}`)}
                    rowActions={(a) => (a.status === 'cancelled' || a.status === 'completed' ? [] : [
                        { label: 'Edit', icon: <Edit2 size={14} />, onSelect: () => setEditingAllocation(a) },
                        { label: 'Cancel allocation', icon: <XCircle size={14} />, danger: true, onSelect: () => handleCancel(a.id) },
                    ])}
                />
            </ListPageTemplate>

            <CreateAllocationModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreate}
            />

            {editingAllocation && (
                <EditAllocationModal
                    allocation={editingAllocation}
                    onClose={() => setEditingAllocation(null)}
                    onSave={(data) => handleUpdate(editingAllocation.id, data)}
                />
            )}
        </>
    );
};

// =============================================================================
// Create Allocation Modal
// =============================================================================

interface CreateAllocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateAllocationPayload) => Promise<void>;
}

const CreateAllocationModal: React.FC<CreateAllocationModalProps> = ({ isOpen, onClose, onCreate }) => {
    const formatters = usePeopleFormatters();
    // Compensation privacy tier — person rates hidden without compensation.read.
    const canViewCompensation = useCanViewCompensation();
    const [people, setPeople] = useState<Person[]>([]);
    const [loadingPeople, setLoadingPeople] = useState(false);
    const emptyForm: CreateAllocationPayload = {
        person_id: '',
        entity_type: 'project',
        entity_id: '',
        entity_name: '',
        start_date: formatters.businessToday(),
        end_date: '',
        allocation_percentage: 50,
        notes: '',
    };
    const [formData, setFormData] = useState<CreateAllocationPayload>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [apiError, setApiError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(emptyForm);
            setErrors({});
            setApiError('');
            setLoadingPeople(true);
            peopleApi.getAll({ status: 'active', limit: 100 })
                .then(result => setPeople(result.data))
                .catch(console.error)
                .finally(() => setLoadingPeople(false));
        }
    }, [isOpen]);

    const validate = (data: CreateAllocationPayload): Record<string, string> => {
        const next: Record<string, string> = {};
        if (!data.person_id) next.person_id = 'Select a person.';
        // Entity is chosen from a dropdown that yields real UUIDs; the isUuid
        // guard stays as a backend-contract safety net.
        if (!data.entity_id.trim()) {
            next.entity_id = 'Select an entity.';
        } else if (!isUuid(data.entity_id)) {
            next.entity_id = 'Entity ID must be a valid UUID (e.g. 550e8400-e29b-41d4-a716-446655440000).';
        }
        if (!data.start_date) next.start_date = 'Start date is required.';
        if (!data.end_date) {
            next.end_date = 'End date is required.';
        } else if (data.start_date && data.end_date < data.start_date) {
            next.end_date = 'End date cannot be earlier than start date.';
        }
        // The input hands back '' when cleared, which the payload type still
        // declares as number — compare on the raw value before coercing.
        const rawPct = data.allocation_percentage as number | string | null | undefined;
        const pct = Number(rawPct);
        if (rawPct === '' || rawPct === null || rawPct === undefined) {
            next.allocation_percentage = 'Allocation percentage is required.';
        } else if (!Number.isFinite(pct) || !Number.isInteger(pct) || pct < 1 || pct > 100) {
            next.allocation_percentage = 'Enter a whole number between 1 and 100.';
        }
        return next;
    };

    // Live validity — drives the submit button so the user never fires an
    // incomplete form and has to read the errors afterwards.
    const isFormValid = Object.keys(validate(formData)).length === 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setApiError('');
        const validationErrors = validate(formData);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        setSubmitting(true);
        try {
            await onCreate({
                person_id: formData.person_id,
                entity_type: formData.entity_type,
                entity_id: formData.entity_id.trim(),
                entity_name: formData.entity_name?.trim() || undefined,
                start_date: formData.start_date,
                end_date: formData.end_date || undefined,
                allocation_percentage: Number(formData.allocation_percentage),
                notes: formData.notes?.trim() || undefined,
            });
        } catch (error) {
            setApiError(error instanceof Error ? error.message : 'Failed to create allocation. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const updateField = (field: string, value: unknown) => {
        const nextData = { ...formData, [field]: value } as CreateAllocationPayload;
        setFormData(nextData);
        // Re-validate the touched field against the new value so a corrected
        // field clears immediately and a newly invalid one flags immediately.
        const fieldErrors = validate(nextData);
        setErrors(prev => ({
            ...prev,
            [field]: fieldErrors[field] || '',
            // The date pair validates as a unit — fixing the start date must
            // clear a stale "end before start" message on the end date.
            ...(field === 'start_date' ? { end_date: fieldErrors.end_date || '' } : {}),
        }));
    };

    const handleEntityTypeChange = (entityType: string) => {
        // Switching type invalidates any previously selected entity.
        setFormData(prev => ({ ...prev, entity_type: entityType, entity_id: '', entity_name: '' }));
        setErrors(prev => (prev.entity_id ? { ...prev, entity_id: '' } : prev));
    };

    const handleEntitySelect = (option: EntityOption | null) => {
        // Store the picked entity's real UUID + display name internally.
        setFormData(prev => ({ ...prev, entity_id: option?.id || '', entity_name: option?.name || '' }));
        setErrors(prev => (prev.entity_id ? { ...prev, entity_id: '' } : prev));
    };

    return (
        <Modal open={isOpen} onClose={onClose} title="Create Allocation" size="lg">
            <form onSubmit={handleSubmit}>
                <Stack gap="default">
                    <Select
                        name="allocations-select-28"
                        label="Person *"
                        required
                        value={formData.person_id}
                        onChange={(e) => updateField('person_id', e.target.value)}
                        options={[{ value: "", label: "Select a person..." }, ...people.map((p) => ({ value: p.id, label: `${p.full_name} - ${p.job_title || p.type}${canViewCompensation ? ` (${formatters.formatCurrency(p.cost_rate)}/${p.cost_rate_unit})` : ''}` }))]}
                    />
                    {errors.person_id && <p role="alert" className="text-nb-xs text-danger">{errors.person_id}</p>}

                    <div className="grid grid-cols-1 wc-medium:grid-cols-3 gap-nb-4">
                        <Select
                            name="allocations-select-29"
                            label="Entity Type *"
                            value={formData.entity_type}
                            onChange={(e) => handleEntityTypeChange(e.target.value)}
                            options={[{ value: "project", label: "Project" }, { value: "task", label: "Task" }, { value: "lead", label: "Lead" }, { value: "customer", label: "Customer" }, { value: "opportunity", label: "Opportunity" }, { value: "department", label: "Department" }]}
                        />
                        <div className="wc-medium:col-span-2">
                            <p className="text-nb-xs text-fg-muted mb-nb-1">
                                {formData.entity_type === 'task' ? 'Project & Task *' : 'Entity *'}
                            </p>
                            <EntitySelector
                                entityType={formData.entity_type as LookupEntityType}
                                value={formData.entity_id}
                                displayName={formData.entity_name}
                                onChange={handleEntitySelect}
                                error={!!errors.entity_id}
                            />
                            {errors.entity_id && <p className="mt-nb-1 text-nb-xs text-danger">{errors.entity_id}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-4">
                        <DateInput
                            name="allocation-start-date"
                            label="Start Date"
                            required
                            aria-label="Start Date"
                            value={formData.start_date}
                            onChange={(v: string) => updateField('start_date', v)}
                            hint="Defaults to today — the allocation starts as soon as it is created."
                            error={errors.start_date || undefined}
                        />
                        <DateInput
                            name="allocation-end-date"
                            label="End Date"
                            required
                            aria-label="End Date"
                            value={formData.end_date}
                            min={formData.start_date || undefined}
                            onChange={(v: string) => updateField('end_date', v)}
                            hint="Required — allocations are costed over a closed window."
                            error={errors.end_date || undefined}
                        />
                    </div>

                    <TextField
                        name="allocation-percentage"
                        label="Allocation Percentage"
                        type="number"
                        required
                        min={1}
                        max={100}
                        step={1}
                        aria-label="Allocation Percentage"
                        value={formData.allocation_percentage}
                        onChange={(e) => updateField('allocation_percentage', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        hint={errors.allocation_percentage ? undefined : "Share of this person's working capacity, 1–100%. The bar below previews the value entered here."}
                        error={errors.allocation_percentage || undefined}
                    />

                    <div>
                        <div className="w-full bg-surface-raised rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all ${Number(formData.allocation_percentage) > 80 ? 'bg-warning' : 'bg-primary'}`}
                                style={{ width: `${Math.min(Number(formData.allocation_percentage) || 0, 100)}%` }}
                            />
                        </div>
                        <div className="text-nb-xs text-fg-subtle mt-nb-1 text-right">{Number(formData.allocation_percentage) || 0}% capacity</div>
                    </div>

                    <Textarea
                        name="allocation-notes"
                        label="Notes"
                        rows={2}
                        value={formData.notes || ''}
                        onChange={(e) => updateField('notes', e.target.value)}
                        placeholder="Additional context for this allocation..."
                    />

                    {apiError && <Banner variant="danger">{apiError}</Banner>}

                    <Cluster justify="end" gap="default">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
                        <Button
                            type="submit"
                            disabled={submitting || !isFormValid}
                            title={isFormValid ? undefined : 'Complete all required fields to create the allocation.'}
                        >
                            {submitting ? 'Creating…' : 'Create Allocation'}
                        </Button>
                    </Cluster>
                </Stack>
            </form>
        </Modal>
    );
};

// =============================================================================
// Edit Allocation Modal
// =============================================================================

interface EditAllocationModalProps {
    allocation: Allocation;
    onClose: () => void;
    onSave: (data: UpdateAllocationPayload) => Promise<void>;
}

const EditAllocationModal: React.FC<EditAllocationModalProps> = ({ allocation, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        allocation_percentage: allocation.allocation_value,
        start_date: allocation.start_date,
        end_date: allocation.end_date,
        status: allocation.status as AllocationStatus,
        notes: allocation.notes || '',
    });
    const [error, setError] = useState('');
    const [apiError, setApiError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setApiError('');
        const pct = Number(formData.allocation_percentage);
        if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
            setError('Allocation percentage must be between 1 and 100.');
            return;
        }
        setSubmitting(true);
        onSave({
            allocation_percentage: pct,
            start_date: formData.start_date,
            end_date: formData.end_date,
            status: formData.status,
            notes: formData.notes,
        }).catch((err: unknown) => {
            setApiError(err instanceof Error ? err.message : 'Failed to update allocation. Please try again.');
            setSubmitting(false);
        });
    };

    return (
        <Modal open onClose={onClose} title={`Edit Allocation - ${allocation.entity_name || allocation.entity_id}`} size="md">
            <form onSubmit={handleSubmit}>
                <Stack gap="default">
                    <p className="text-nb-xs text-fg-subtle">
                        {allocation.person?.full_name} allocated to {allocation.entity_name || allocation.entity_id}
                    </p>

                    <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-4">
                        <DateInput
                            name="allocation-edit-start-date"
                            label="Start Date"
                            value={formData.start_date}
                            onChange={(v: string) => setFormData(d => ({ ...d, start_date: v }))}
                        />
                        <DateInput
                            name="allocation-edit-end-date"
                            label="End Date"
                            value={formData.end_date}
                            onChange={(v: string) => setFormData(d => ({ ...d, end_date: v }))}
                        />
                    </div>

                    <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-4">
                        <TextField
                            name="allocation-edit-percentage"
                            label="Allocation Percentage (1-100%)"
                            type="number"
                            min={1}
                            max={100}
                            value={formData.allocation_percentage}
                            onChange={(e) => { setError(''); setFormData(d => ({ ...d, allocation_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value) })); }}
                            error={error || undefined}
                        />
                        <Select
                            name="allocations-select-30"
                            label="Status"
                            value={formData.status}
                            onChange={(e) => setFormData(d => ({ ...d, status: e.target.value as AllocationStatus }))}
                            options={[{ value: "planned", label: "Planned" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }]}
                        />
                    </div>

                    <Textarea
                        name="allocation-edit-notes"
                        label="Notes"
                        rows={2}
                        value={formData.notes}
                        onChange={(e) => setFormData(d => ({ ...d, notes: e.target.value }))}
                    />

                    {apiError && <Banner variant="danger">{apiError}</Banner>}

                    <Cluster justify="end" gap="default">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
                        <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save Changes'}</Button>
                    </Cluster>
                </Stack>
            </form>
        </Modal>
    );
};

export default AllocationsPage;

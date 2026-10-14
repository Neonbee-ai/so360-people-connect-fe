import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Target, Plus, Search, Calendar, User,
    ArrowRight, ChevronDown, MoreHorizontal, Edit2, XCircle,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { toast, useConfirm, Select } from '@so360/design-system';
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

    return (
        <div className="p-6 space-y-5">
          {confirmDialog}
            <PageHeader
                title="Allocations"
                subtitle="Assign people to execution entities with capacity control"
                actions={canCreateAllocation ? (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors"
                    >
                        <Plus size={16} />
                        New Allocation
                    </button>
                ) : undefined}
            />

            {/* Filters — controls and summary share one row and one baseline, so
                the stats never float away from the filter group. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                <Select name="allocations-select-25" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[{ value: "", label: "All Statuses" }, { value: "planned", label: "Planned" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]} />
                <Select name="allocations-select-26" value={entityTypeFilter} onChange={(e) => setEntityTypeFilter(e.target.value)} options={[{ value: "", label: "All Entity Types" }, { value: "project", label: "Project" }, { value: "task", label: "Task" }, { value: "lead", label: "Lead" }, { value: "customer", label: "Customer" }, { value: "opportunity", label: "Opportunity" }, { value: "department", label: "Department" }]} />
                <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                >
                    <option value="">All Departments</option>
                    {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>
                            {dept.depth > 0 ? `${'  '.repeat(dept.depth)}└ ` : ''}{dept.name}
                        </option>
                    ))}
                </select>
                </div>

                {/* Summary Stats */}
                <div className="flex items-center gap-4 text-xs text-fg-muted">
                    <span>{allocations.length} allocation{allocations.length !== 1 ? 's' : ''}</span>
                    <span>{allocations.filter(a => a.status === 'active').length} active</span>
                    <span className="text-warning">
                        {Object.values(allocationsByPerson).filter(p => p.totalPct > 100).length} overallocated
                    </span>
                </div>
            </div>

            {/* Allocations List */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-24 bg-surface-raised/50 rounded-nb animate-pulse" />
                    ))}
                </div>
            ) : allocations.length === 0 ? (
                <EmptyState
                    icon={Target}
                    title="No allocations"
                    description="Create allocations to assign people to projects, tasks, or other execution entities."
                    action={{ label: 'Create Allocation', onClick: () => setShowCreateModal(true) }}
                />
            ) : (
                <div className="space-y-2">
                    {allocations.map((alloc) => {
                        const personData = allocationsByPerson[alloc.person_id];
                        const isOverallocated = personData && personData.totalPct > 100;

                        return (
                            <div
                                key={alloc.id}
                                className={`bg-surface border rounded-xl p-4 transition-all ${
                                    isOverallocated && alloc.status === 'active'
                                        ? 'border-warning/30'
                                        : 'border-line hover:border-line-strong'
                                }`}
                            >
                                {/* Fixed column track so every row lines up: avatar |
                                    info (flexes) | % | status | actions. The trailing
                                    columns are sized, not content-driven, so a long
                                    entity name can never push them out of alignment. */}
                                <div className="grid items-center gap-4 grid-cols-[2.5rem_minmax(0,1fr)_5.5rem_6rem_4.5rem]">
                                    {/* Person Avatar */}
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/20 border border-line-strong flex items-center justify-center flex-shrink-0">
                                        <span className="text-xs font-medium text-primary">
                                            {(alloc.person?.full_name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2)}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5 min-w-0">
                                            <span
                                                onClick={() => navigate(`/people/people/${alloc.person_id}`)}
                                                className="text-sm font-medium text-fg hover:text-primary cursor-pointer truncate"
                                            >
                                                {alloc.person?.full_name || 'Unknown Person'}
                                            </span>
                                            <ArrowRight size={12} className="text-fg-subtle flex-shrink-0" />
                                            <span className="text-sm text-fg truncate">
                                                {alloc.entity_name || alloc.entity_id}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-fg-subtle min-w-0">
                                            <span className="flex items-center gap-1 flex-shrink-0">
                                                <Calendar size={11} />
                                                {alloc.start_date} to {alloc.end_date}
                                            </span>
                                            <span className="text-fg-subtle flex-shrink-0 capitalize">{alloc.entity_type}</span>
                                            {alloc.notes && <span className="truncate">{alloc.notes}</span>}
                                        </div>
                                    </div>

                                    {/* Allocation Value */}
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-fg leading-tight">
                                            {alloc.allocation_value}
                                            <span className="text-sm text-fg-muted ml-0.5">%</span>
                                        </div>
                                        {isOverallocated && alloc.status === 'active' && (
                                            <div className="text-xs text-warning leading-tight">
                                                Total: {personData.totalPct}%
                                            </div>
                                        )}
                                    </div>

                                    {/* Status */}
                                    <div className="flex justify-start">
                                        <StatusBadge status={alloc.status} />
                                    </div>

                                    {/* Actions — always occupies its column so rows without
                                        actions keep the same track widths. */}
                                    <div className="flex items-center justify-end gap-1">
                                        {alloc.status !== 'cancelled' && alloc.status !== 'completed' && (
                                            <>
                                                <button
                                                    onClick={() => setEditingAllocation(alloc)}
                                                    className="p-1.5 rounded-nb text-fg-subtle hover:text-fg hover:bg-surface-raised transition-colors"
                                                    title="Edit"
                                                    aria-label="Edit allocation"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleCancel(alloc.id)}
                                                    className="p-1.5 rounded-nb text-fg-subtle hover:text-danger hover:bg-surface-raised transition-colors"
                                                    title="Cancel"
                                                    aria-label="Cancel allocation"
                                                >
                                                    <XCircle size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Capacity bar — rendered on every card (empty track for
                                    non-active allocations) so each row is the same height
                                    and the bar always sits the same distance from the
                                    card edge. */}
                                <div className="mt-3 pt-3 border-t border-line/50">
                                    <div className="w-full bg-surface-raised rounded-full h-1.5" role="presentation">
                                        {alloc.status === 'active' && (
                                            <div
                                                className={`h-1.5 rounded-full transition-all ${
                                                    (alloc.allocation_value ?? 0) > 80 ? 'bg-warning' : 'bg-primary'
                                                }`}
                                                style={{ width: `${Math.min(alloc.allocation_value ?? 0, 100)}%` }}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Modal */}
            <CreateAllocationModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreate}
            />

            {/* Edit Modal */}
            {editingAllocation && (
                <EditAllocationModal
                    allocation={editingAllocation}
                    onClose={() => setEditingAllocation(null)}
                    onSave={(data) => handleUpdate(editingAllocation.id, data)}
                />
            )}

        </div>
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
        <Modal isOpen={isOpen} onClose={onClose} title="Create Allocation" size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Person Selection */}
                <div>
                    <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Resource</h4>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Person *</label>
                        <Select name="allocations-select-28" required value={formData.person_id} onChange={(e) => updateField('person_id', e.target.value)} options={[{ value: "", label: "Select a person..." }, ...people.map((p) => ({ value: p.id, label: `${p.full_name} - ${p.job_title || p.type}${canViewCompensation ? ` (${formatters.formatCurrency(p.cost_rate)}/${p.cost_rate_unit})` : ''}` }))]} />
                        {errors.person_id && <p className="mt-1 text-xs text-danger">{errors.person_id}</p>}
                    </div>
                </div>

                {/* Execution Entity */}
                <div>
                    <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Execution Entity</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-fg-muted mb-1">Entity Type *</label>
                            <Select name="allocations-select-29" value={formData.entity_type} onChange={(e) => handleEntityTypeChange(e.target.value)} options={[{ value: "project", label: "Project" }, { value: "task", label: "Task" }, { value: "lead", label: "Lead" }, { value: "customer", label: "Customer" }, { value: "opportunity", label: "Opportunity" }, { value: "department", label: "Department" }]} />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs text-fg-muted mb-1">
                                {formData.entity_type === 'task' ? 'Project & Task *' : 'Entity *'}
                            </label>
                            <EntitySelector
                                entityType={formData.entity_type as LookupEntityType}
                                value={formData.entity_id}
                                displayName={formData.entity_name}
                                onChange={handleEntitySelect}
                                error={!!errors.entity_id}
                            />
                            {errors.entity_id && <p className="mt-1 text-xs text-danger">{errors.entity_id}</p>}
                        </div>
                    </div>
                </div>

                {/* Allocation Window */}
                <div>
                    <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Allocation Window</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-fg-muted mb-1">Start Date *</label>
                            <input
                                type="date" required aria-label="Start Date" value={formData.start_date}
                                onChange={(e) => updateField('start_date', e.target.value)}
                                className={`w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-fg focus:outline-none ${errors.start_date ? 'border-danger focus:border-danger' : 'border-line-strong focus:border-primary'}`}
                            />
                            <p className="mt-1 text-xs text-fg-subtle">Defaults to today — the allocation starts as soon as it is created.</p>
                            {errors.start_date && <p className="mt-1 text-xs text-danger">{errors.start_date}</p>}
                        </div>
                        <div>
                            <label className="block text-xs text-fg-muted mb-1">End Date *</label>
                            <input
                                type="date" required aria-label="End Date" value={formData.end_date}
                                min={formData.start_date || undefined}
                                onChange={(e) => updateField('end_date', e.target.value)}
                                className={`w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-fg focus:outline-none ${errors.end_date ? 'border-danger focus:border-danger' : 'border-line-strong focus:border-primary'}`}
                            />
                            <p className="mt-1 text-xs text-fg-subtle">Required — allocations are costed over a closed window.</p>
                            {errors.end_date && <p className="mt-1 text-xs text-danger">{errors.end_date}</p>}
                        </div>
                    </div>
                </div>

                {/* Allocation Amount */}
                <div>
                    <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Allocation Amount</h4>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Allocation Percentage *</label>
                        <input
                            type="number" required min="1" max="100" step="1"
                            aria-label="Allocation Percentage"
                            value={formData.allocation_percentage}
                            onChange={(e) => updateField('allocation_percentage', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className={`w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-fg focus:outline-none ${errors.allocation_percentage ? 'border-danger focus:border-danger' : 'border-line-strong focus:border-primary'}`}
                        />
                        {errors.allocation_percentage ? (
                            <p className="mt-1 text-xs text-danger">{errors.allocation_percentage}</p>
                        ) : (
                            <p className="mt-1 text-xs text-fg-subtle">
                                Share of this person's working capacity, 1–100%. The bar below previews the value entered here.
                            </p>
                        )}
                    </div>

                    {/* Visual Preview */}
                    <div className="mt-3">
                        <div className="w-full bg-surface-raised rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all ${
                                    Number(formData.allocation_percentage) > 80 ? 'bg-warning' :
                                    Number(formData.allocation_percentage) > 50 ? 'bg-primary' : 'bg-primary'
                                }`}
                                style={{ width: `${Math.min(Number(formData.allocation_percentage) || 0, 100)}%` }}
                            />
                        </div>
                        <div className="text-xs text-fg-subtle mt-1 text-right">{Number(formData.allocation_percentage) || 0}% capacity</div>
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-xs text-fg-muted mb-1">Notes</label>
                    <textarea
                        value={formData.notes || ''}
                        onChange={(e) => updateField('notes', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary resize-none"
                        placeholder="Additional context for this allocation..."
                    />
                </div>

                {/* API error banner */}
                {apiError && (
                    <div className="px-3 py-2 bg-danger/10 border border-danger/30 rounded-nb text-sm text-danger">
                        {apiError}
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                    <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors disabled:opacity-50">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting || !isFormValid}
                        title={isFormValid ? undefined : 'Complete all required fields to create the allocation.'}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Creating…' : 'Create Allocation'}
                    </button>
                </div>
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
        <Modal isOpen={true} onClose={onClose} title={`Edit Allocation - ${allocation.entity_name || allocation.entity_id}`} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="text-xs text-fg-subtle mb-4">
                    {allocation.person?.full_name} allocated to {allocation.entity_name || allocation.entity_id}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Start Date</label>
                        <input
                            type="date" value={formData.start_date}
                            onChange={(e) => setFormData(d => ({ ...d, start_date: e.target.value }))}
                            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">End Date</label>
                        <input
                            type="date" value={formData.end_date}
                            onChange={(e) => setFormData(d => ({ ...d, end_date: e.target.value }))}
                            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Allocation Percentage (1-100%)</label>
                        <input
                            type="number" min="1" max="100" value={formData.allocation_percentage}
                            onChange={(e) => { setError(''); setFormData(d => ({ ...d, allocation_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value) })); }}
                            className={`w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm text-fg focus:outline-none ${error ? 'border-danger focus:border-danger' : 'border-line-strong focus:border-primary'}`}
                        />
                        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
                    </div>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Status</label>
                        <Select name="allocations-select-30" value={formData.status} onChange={(e) => setFormData(d => ({ ...d, status: e.target.value as AllocationStatus }))} options={[{ value: "planned", label: "Planned" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }]} />
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-fg-muted mb-1">Notes</label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData(d => ({ ...d, notes: e.target.value }))}
                        rows={2}
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary resize-none"
                    />
                </div>

                {apiError && (
                    <div className="px-3 py-2 bg-danger/10 border border-danger/30 rounded-nb text-sm text-danger">
                        {apiError}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                    <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors disabled:opacity-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors disabled:opacity-50">
                        {submitting ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AllocationsPage;

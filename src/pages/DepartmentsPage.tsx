import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, ChevronRight, Users } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { useActivity, useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import {
    Alert,
    Button,
    Card,
    Checkbox,
    Cluster,
    FieldGrid,
    IconButton,
    ListPageTemplate,
    QuotaBar,
    QuotaGate,
    Select,
    Stack,
    Textarea,
    TextField,
    toast,
} from '@so360/design-system';
import { departmentsApi, Department, CreateDepartmentPayload } from '../services/departmentsService';
import { peopleApi } from '../services/peopleService';
import type { Person } from '../types/people';
import { validateDepartmentCode, validateDepartmentName, focusFirstInvalid } from '../utils/validation';

const DepartmentsPage: React.FC = () => {
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    // Department structure is org master-data. Gate management actions on the
    // user's ROLE permission — not just the plan feature flag, which every member
    // of an entitled org would pass. Fail closed: until entitlements resolve, and
    // for anyone lacking the code, the action is hidden. The feature flag is kept
    // as the plan-tier ceiling (both must hold), and an owner/admin resolves the
    // wildcard so retains full access.
    const permsReady = shell?.permissionsLoaded === true;
    const planAllowsCreate = shell?.effectiveFlagsLoaded !== false && (shell?.isFeatureEnabled?.('action:people:departments:create') ?? true);
    const canCreate = permsReady && (shell?.hasPermission?.('departments.create') ?? false) && planAllowsCreate;
    const canEdit = permsReady && (shell?.hasPermission?.('departments.update') ?? false);
    const quotaChecks = useMemo(() => [{ module_code: 'people', quota_key: 'max_departments' }], []);
    const { getQuota, refresh: refreshQuota } = useQuota({ checks: quotaChecks, orgId: shell?.currentOrg?.id || '' });
    const quotaData = getQuota('max_departments');
    const { isSandboxMode, sandboxEntryLimit, limitItems, isLimited } = useSandboxLimit();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const loadDepartments = useCallback(async () => {
        try {
            setLoading(true);
            const result = await departmentsApi.getTree();
            setDepartments(result.data);
            // Expand all by default
            const allIds = new Set(result.data.map(d => d.id));
            setExpandedIds(allIds);
        } catch (error) {
            console.error('Failed to load departments:', error);
            toast.error('Failed to load departments');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDepartments();
    }, [loadDepartments]);

    const handleCreate = async (data: CreateDepartmentPayload) => {
        try {
            const created = await departmentsApi.create(data);
            setShowCreateModal(false);
            toast.success(`Department ${data.name} has been created`);
            recordActivity({ eventType: 'people.department.created', eventCategory: 'identity', description: `Department ${data.name} was created`, resourceType: 'department', resourceId: created?.id }).catch(() => {});
            loadDepartments();
            refreshQuota().catch(() => {});
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create department');
        }
    };

    const handleUpdate = async (id: string, data: Partial<Department>) => {
        try {
            await departmentsApi.update(id, data);
            setEditingDepartment(null);
            toast.success('Department updated successfully');
            recordActivity({ eventType: 'people.department.updated', eventCategory: 'identity', description: `Department ${data.name || id} was updated`, resourceType: 'department', resourceId: id }).catch(() => {});
            loadDepartments();
            refreshQuota().catch(() => {});
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update department');
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const renderDepartment = (dept: Department, depth: number = 0) => {
        const hasChildren = dept.children && dept.children.length > 0;
        const isExpanded = expandedIds.has(dept.id);

        return (
            <React.Fragment key={dept.id}>
                <div style={{ marginLeft: `${depth * 20}px` }}>
                    <Card padding="sm" name={`department-${dept.id}`}>
                        <Cluster gap="default" justify="between">
                            <Cluster gap="default">
                                {/* Expand/Collapse */}
                                <IconButton
                                    label={hasChildren ? (isExpanded ? 'Collapse' : 'Expand') : 'No sub-departments'}
                                    icon={hasChildren ? (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <ChevronRight size={16} className="invisible" />}
                                    size="sm"
                                    onClick={() => hasChildren && toggleExpand(dept.id)}
                                    disabled={!hasChildren}
                                />

                                {/* Info — clickable area navigates to department detail */}
                                <div
                                    className="min-w-0 cursor-pointer"
                                    onClick={() => navigate(`/people/departments/${dept.id}`)}
                                >
                                    <Cluster>
                                        <span className="text-nb-sm font-medium text-fg truncate hover:text-primary transition-colors">{dept.name}</span>
                                        <span className="text-nb-caption text-fg-subtle">{dept.code}</span>
                                        <StatusBadge status={dept.is_active ? 'active' : 'inactive'} />
                                    </Cluster>
                                    <Cluster gap="default" className="text-nb-caption text-fg-subtle">
                                        {/* A department without a head has no reporting edge, so leave
                                            approvals and reviewer eligibility for everyone in it resolve
                                            to nobody. Silent until now, which is how the platform reached
                                            32 departments with 0 heads. */}
                                        {!dept.head_person_id && dept.is_active && (
                                            <span
                                                className="text-warning"
                                                title="Leave approvals and reviews for this department have nobody to route to"
                                            >
                                                No head assigned
                                            </span>
                                        )}
                                        {dept.head_person && (
                                            <span>Head: {dept.head_person.full_name}</span>
                                        )}
                                        {dept.employee_count !== undefined && (
                                            <Cluster gap="tight">
                                                <Users size={12} />
                                                {dept.employee_count} employees
                                            </Cluster>
                                        )}
                                    </Cluster>
                                </div>
                            </Cluster>

                            {/* Actions */}
                            {canEdit && <Button variant="ghost" size="sm" onClick={() => setEditingDepartment(dept)}>
                                Edit
                            </Button>}
                        </Cluster>
                    </Card>
                </div>

                {/* Children */}
                {hasChildren && isExpanded && dept.children?.map(child => renderDepartment(child, depth + 1))}
            </React.Fragment>
        );
    };

    const visibleDepartments = isSandboxMode ? departments.slice(0, sandboxEntryLimit) : departments;

    return (
        <>
            <ListPageTemplate
                title="Departments"
                description="Manage organizational structure"
                primaryAction={
                    canCreate ? (
                        <QuotaGate
                            quotaKey="max_departments"
                            moduleCode="people"
                            used={quotaData?.current_usage ?? 0}
                            limit={quotaData?.limit ?? 0}
                            isUnlimited={quotaData?.is_unlimited}
                            disableOnExceeded
                        >
                            <Button
                                onClick={() => setShowCreateModal(true)}
                                disabled={isSandboxMode}
                                title={isSandboxMode ? 'Not available in Sandbox mode' : undefined}
                            >
                                <Building2 size={16} />
                                Create Department
                            </Button>
                        </QuotaGate>
                    ) : undefined
                }
                loading={loading}
                isEmpty={departments.length === 0}
                empty={
                    <EmptyState
                        icon={Building2}
                        title="No departments found"
                        description="Create your first department to organize your team."
                        action={canCreate ? { label: 'Create Department', onClick: () => setShowCreateModal(true) } : undefined}
                    />
                }
                kpis={
                    quotaData || (isSandboxMode && isLimited(departments.length)) ? (
                        <Stack>
                            {quotaData && (
                                <QuotaBar
                                    label="Departments"
                                    used={quotaData.current_usage}
                                    limit={quotaData.limit}
                                    isUnlimited={quotaData.is_unlimited}
                                />
                            )}
                            {isSandboxMode && isLimited(departments.length) && (
                                <Alert variant="warning">
                                    <span className="font-semibold">Sandbox:</span>{' '}
                                    <span>Showing {sandboxEntryLimit} of {departments.length} records. Switch to Production to view all.</span>
                                </Alert>
                            )}
                        </Stack>
                    ) : undefined
                }
            >
                {/* Departments Tree */}
                <Stack gap="tight">{visibleDepartments.map(dept => renderDepartment(dept))}</Stack>
            </ListPageTemplate>

            {/* Create/Edit Modal */}
            <DepartmentModal
                isOpen={showCreateModal || !!editingDepartment}
                onClose={() => {
                    setShowCreateModal(false);
                    setEditingDepartment(null);
                }}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
                department={editingDepartment}
                departments={departments}
            />
        </>
    );
};

// =============================================================================
// Department Modal
// =============================================================================

interface DepartmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateDepartmentPayload) => void;
    onUpdate: (id: string, data: Partial<Department>) => void;
    department: Department | null;
    departments: Department[];
}

interface FlatDepartment extends Department {
    depth: number;
    ancestorIds: string[];
    ancestorNames: string[];
}

const flattenDepartmentTree = (nodes: Department[], depth = 0, ancestorIds: string[] = [], ancestorNames: string[] = []): FlatDepartment[] => {
    const result: FlatDepartment[] = [];
    for (const node of nodes) {
        result.push({ ...node, depth, ancestorIds, ancestorNames });
        if (node.children?.length) {
            result.push(...flattenDepartmentTree(node.children, depth + 1, [...ancestorIds, node.id], [...ancestorNames, node.name]));
        }
    }
    return result;
};

const DepartmentModal: React.FC<DepartmentModalProps> = ({
    isOpen,
    onClose,
    onCreate,
    onUpdate,
    department,
    departments,
}) => {
    const [formData, setFormData] = useState<CreateDepartmentPayload>({
        code: '',
        name: '',
        description: '',
        parent_id: undefined,
        head_person_id: undefined,
        is_active: true,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [people, setPeople] = useState<Person[]>([]);
    const formRef = useRef<HTMLFormElement>(null);

    // The head is what makes the reporting graph exist. Without it every
    // manager-scoped feature — leave approver routing, reviewer eligibility,
    // "my team" views — has no edge to walk and silently resolves to nobody.
    useEffect(() => {
        if (!isOpen) return;
        peopleApi
            .getAll({ status: 'active', limit: 200 })
            .then(res => setPeople(res.data))
            .catch(() => undefined);
    }, [isOpen]);

    useEffect(() => {
        setErrors({});
        if (department) {
            setFormData({
                code: department.code,
                name: department.name,
                description: department.description || '',
                parent_id: department.parent_id,
                head_person_id: department.head_person_id,
                is_active: department.is_active,
            });
        } else {
            setFormData({
                code: '',
                name: '',
                description: '',
                parent_id: undefined,
                head_person_id: undefined,
                is_active: true,
            });
        }
    }, [department]);

    // Flatten the full tree so any department at any depth is selectable as a parent.
    const flatList = useMemo(() => flattenDepartmentTree(departments), [departments]);

    // Code/name are business master data: format-check them, and catch a
    // duplicate code locally so the user sees it inline instead of as a 409
    // toast after a round trip. The backend re-checks both (see
    // CreateDepartmentDto / departments.service).
    const validate = useCallback((data: CreateDepartmentPayload): Record<string, string> => {
        const next: Record<string, string> = {};
        const codeError = validateDepartmentCode(data.code);
        if (codeError) {
            next.code = codeError;
        } else if (
            flatList.some(
                d => d.id !== department?.id && d.code?.trim().toLowerCase() === data.code.trim().toLowerCase(),
            )
        ) {
            next.code = 'This department code already exists.';
        }
        const nameError = validateDepartmentName(data.name);
        if (nameError) next.name = nameError;
        return next;
    }, [flatList, department?.id]);

    const isFormValid = Object.keys(validate(formData)).length === 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const validationErrors = validate(formData);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            focusFirstInvalid(formRef.current, ['code', 'name'], validationErrors);
            return;
        }

        const payload = { ...formData, code: formData.code.trim(), name: formData.name.trim() };
        if (department) {
            onUpdate(department.id, payload);
        } else {
            onCreate(payload);
        }
    };

    const updateField = (field: keyof CreateDepartmentPayload, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (field === 'code' || field === 'name') {
            const fieldErrors = validate({ ...formData, [field]: value } as CreateDepartmentPayload);
            setErrors(prev => ({ ...prev, [field]: fieldErrors[field] || '' }));
        }
    };

    // A department can't become its own parent, nor can any of its descendants
    // (that would create a cycle) — exclude those from the selector entirely.
    const eligibleParents = useMemo(() => {
        if (!department) return flatList;
        return flatList.filter(d => d.id !== department.id && !d.ancestorIds.includes(department.id));
    }, [flatList, department]);

    const reportingPath = useMemo(() => {
        if (!formData.parent_id) return null;
        const selected = flatList.find(d => d.id === formData.parent_id);
        if (!selected) return null;
        return [...selected.ancestorNames, selected.name];
    }, [flatList, formData.parent_id]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={department ? 'Edit Department' : 'Create Department'}>
            {/* noValidate: application-level inline messages replace the browser's
                native validation bubbles, which are inconsistent across browsers. */}
            <form ref={formRef} onSubmit={handleSubmit} noValidate>
                <Stack gap="default">
                    <FieldGrid columns={2}>
                        <TextField
                            id="dept-code"
                            name="dept-code"
                            data-field="code"
                            label="Code *"
                            value={formData.code}
                            onChange={(e) => updateField('code', e.target.value)}
                            aria-invalid={!!errors.code}
                            aria-describedby={errors.code ? 'dept-code-error' : undefined}
                            placeholder="ENG"
                            error={errors.code || undefined}
                            hint={errors.code ? undefined : '2–20 letters/numbers, e.g. ENG or HR-01.'}
                        />
                        <TextField
                            id="dept-name"
                            name="dept-name"
                            data-field="name"
                            label="Name *"
                            value={formData.name}
                            onChange={(e) => updateField('name', e.target.value)}
                            aria-invalid={!!errors.name}
                            aria-describedby={errors.name ? 'dept-name-error' : undefined}
                            placeholder="Engineering"
                            error={errors.name || undefined}
                        />
                    </FieldGrid>

                    <Textarea
                        name="dept-description"
                        label="Description"
                        value={formData.description || ''}
                        onChange={(e) => updateField('description', e.target.value)}
                        rows={3}
                        placeholder="Department description..."
                    />

                    <Select
                        name="dept-parent"
                        label="Parent Department"
                        value={formData.parent_id || ''}
                        onChange={(e) => updateField('parent_id', e.target.value || undefined)}
                        options={[
                            { value: '', label: 'None (Top Level)' },
                            ...eligibleParents.map(dept => ({
                                value: dept.id,
                                label: `${dept.depth > 0 ? `${'  '.repeat(dept.depth)}└ ` : ''}${dept.name}`,
                            })),
                        ]}
                        hint={reportingPath ? `Reporting Path: ${reportingPath.join(' → ')}` : undefined}
                    />

                    <Select
                        name="departments-select-35"
                        label="Department Head"
                        value={formData.head_person_id || ''}
                        onChange={(e) => updateField('head_person_id', e.target.value || undefined)}
                        options={[{ value: "", label: "Not assigned" }, ...people.map((person) => ({ value: person.id, label: `${person.full_name}${person.job_title ? ` — $${person.job_title}` : ''}` }))]}
                        hint="Approvals and reviews for this department route to its head."
                    />

                    <Checkbox
                        id="is_active"
                        name="is_active"
                        label="Active"
                        checked={!!formData.is_active}
                        onChange={(e) => updateField('is_active', e.target.checked)}
                    />

                    {/* Actions */}
                    <Cluster justify="end">
                        <Button type="button" variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!isFormValid}
                            title={isFormValid ? undefined : 'Enter a valid department code and name.'}
                        >
                            {department ? 'Update' : 'Create'}
                        </Button>
                    </Cluster>
                </Stack>
            </form>
        </Modal>
    );
};

export default DepartmentsPage;

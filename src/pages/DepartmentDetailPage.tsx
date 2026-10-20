import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Building2, Users, UserCheck, User,
    Calendar, Edit2, UserPlus, Archive, BarChart2,
    Mail, Briefcase, Shield, X,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import {
    toast, Select, DataTable, type DataTableColumn,
    Alert, Avatar, Button, Card, Checkbox, Cluster, DetailPageTemplate, FieldGrid, Grid, KpiCard,
    PageContainer, Stack, TextField, Textarea,
} from '@so360/design-system';
import EmptyState from '../components/EmptyState';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { departmentsApi, Department, DepartmentEmployee } from '../services/departmentsService';
import { peopleApi } from '../services/peopleService';
import { departmentScopeApi, DepartmentScopeGrantee } from '../services/departmentScopeService';
import { apiContext } from '../services/apiClient';
import type { Person } from '../types/people';

// =============================================================================
// Edit Department Modal
// =============================================================================

interface EditModalProps {
    isOpen: boolean;
    onClose: () => void;
    department: Department;
    onSave: (data: Partial<Department>) => void;
}

const EditDepartmentModal: React.FC<EditModalProps> = ({ isOpen, onClose, department, onSave }) => {
    const [form, setForm] = useState({
        name: department.name,
        code: department.code,
        description: department.description || '',
        is_active: department.is_active,
    });

    useEffect(() => {
        setForm({
            name: department.name,
            code: department.code,
            description: department.description || '',
            is_active: department.is_active,
        });
    }, [department]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.code) return;
        onSave(form);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Department">
            <form onSubmit={handleSubmit}>
                <Stack gap="default">
                    <FieldGrid>
                        <TextField
                            name="dept-edit-code"
                            label="Code *"
                            required
                            value={form.code}
                            onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                        />
                        <TextField
                            name="dept-edit-name"
                            label="Name *"
                            required
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        />
                    </FieldGrid>
                    <Textarea
                        name="dept-edit-description"
                        label="Description"
                        rows={3}
                        value={form.description}
                        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    />
                    <Checkbox
                        name="edit_is_active"
                        label="Active"
                        checked={form.is_active}
                        onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                    />
                    <Cluster justify="end" gap="tight">
                        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit">Save Changes</Button>
                    </Cluster>
                </Stack>
            </form>
        </Modal>
    );
};

// =============================================================================
// Assign Manager Modal
// =============================================================================

interface AssignManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentHeadId?: string;
    onAssign: (personId: string) => void;
}

const AssignManagerModal: React.FC<AssignManagerModalProps> = ({ isOpen, onClose, currentHeadId, onAssign }) => {
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState(currentHeadId || '');
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setSelectedId(currentHeadId || '');
        setSearch('');
        setLoading(true);
        peopleApi.getAll({ status: 'active', limit: 200 })
            .then(res => setPeople(res.data ?? []))
            .catch(() => setPeople([]))
            .finally(() => setLoading(false));
    }, [isOpen, currentHeadId]);

    const filtered = search
        ? people.filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()))
        : people;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedId) return;
        onAssign(selectedId);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Assign Department Manager">
            <form onSubmit={handleSubmit}>
                <Stack gap="default">
                    <p className="text-nb-body text-fg-muted">Select a person from the People Registry to assign as Department Head.</p>
                    <TextField
                        name="dept-manager-search"
                        label="Search"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name..."
                    />
                    {loading ? (
                        <p className="text-nb-caption text-fg-muted">Loading…</p>
                    ) : (
                        <Select name="departmentdetail-select-32" label="Select Manager *" required value={selectedId} onChange={e => setSelectedId(e.target.value)} options={[{ value: "", label: "Select a person" }, ...filtered.map((p) => ({ value: p.id, label: `${p.full_name}${p.job_title ? ` — $${p.job_title}` : ''}` }))]} />
                    )}
                    <Cluster justify="end" gap="tight">
                        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={!selectedId}>Assign Manager</Button>
                    </Cluster>
                </Stack>
            </form>
        </Modal>
    );
};

// =============================================================================
// Grant Department Access Modal
// =============================================================================

interface GrantAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGrant: (userId: string, includeDescendants: boolean) => Promise<void>;
}

const GrantAccessModal: React.FC<GrantAccessModalProps> = ({ isOpen, onClose, onGrant }) => {
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [includeDescendants, setIncludeDescendants] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedUserId('');
        setSearch('');
        setIncludeDescendants(true);
        setLoading(true);
        peopleApi.getAll({ status: 'active', limit: 200 })
            .then(res => setPeople((res.data ?? []).filter(p => !!p.linked_user_id)))
            .catch(() => setPeople([]))
            .finally(() => setLoading(false));
    }, [isOpen]);

    const filtered = search
        ? people.filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()))
        : people;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId) return;
        setSubmitting(true);
        try {
            await onGrant(selectedUserId, includeDescendants);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Grant Department Access">
            <form onSubmit={handleSubmit}>
                <Stack gap="default">
                    <p className="text-nb-body text-fg-muted">
                        Grant a person visibility into this department in People Registry and Departments —
                        only people with a linked login can be granted access.
                    </p>
                    <TextField
                        name="dept-grant-search"
                        label="Search"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name..."
                    />
                    {loading ? (
                        <p className="text-nb-caption text-fg-muted">Loading…</p>
                    ) : filtered.length === 0 ? (
                        <p className="text-nb-caption text-fg-muted">No people with a linked login found.</p>
                    ) : (
                        <Select name="departmentdetail-select-33" label="Select Person *" required value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} options={[{ value: "", label: "Select a person" }, ...filtered.map((p) => ({ value: p.linked_user_id as string, label: `${p.full_name}${p.job_title ? ` — $${p.job_title}` : ''}` }))]} />
                    )}
                    <Checkbox
                        name="include_descendants"
                        label="Also include all sub-departments"
                        checked={includeDescendants}
                        onChange={e => setIncludeDescendants(e.target.checked)}
                    />
                    <Cluster justify="end" gap="tight">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
                        <Button type="submit" disabled={!selectedUserId || submitting}>
                            {submitting ? 'Granting…' : 'Grant Access'}
                        </Button>
                    </Cluster>
                </Stack>
            </form>
        </Modal>
    );
};

// =============================================================================
// Department Detail Page
// =============================================================================

const DepartmentDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    // Gate on the user's ROLE permission, fail-closed until entitlements resolve.
    // Edit actions need departments.update; Archive is a soft-delete → departments.delete.
    const permsReady = shell?.permissionsLoaded === true;
    const canEdit = permsReady && (shell?.hasPermission?.('departments.update') ?? false);
    const canArchive = permsReady && (shell?.hasPermission?.('departments.delete') ?? false);

    const [department, setDepartment] = useState<Department | null>(null);
    const [employees, setEmployees] = useState<DepartmentEmployee[]>([]);
    const [employeeTotal, setEmployeeTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<'not_found' | 'load_failed' | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'access'>('overview');
    const [showEditModal, setShowEditModal] = useState(false);
    const [showAssignManagerModal, setShowAssignManagerModal] = useState(false);
    const [showGrantAccessModal, setShowGrantAccessModal] = useState(false);
    const [scopeGrantees, setScopeGrantees] = useState<DepartmentScopeGrantee[]>([]);
    const [loadingScopes, setLoadingScopes] = useState(false);

    const loadData = useCallback(async () => {
        if (!id) return;
        let cancelled = false;
        setLoading(true);
        setLoadError(null);

        let deptData: Department | null = null;
        try {
            deptData = await departmentsApi.getById(id);
        } catch {
            if (cancelled) return;
            setLoadError('load_failed');
            setLoading(false);
            return;
        }
        if (cancelled) return;
        if (!deptData || !deptData.id) {
            setLoadError('not_found');
            setLoading(false);
            return;
        }
        setDepartment(deptData);

        const [empRes] = await Promise.allSettled([
            departmentsApi.getEmployees(id, { limit: 100 }),
        ]);
        if (cancelled) return;
        if (empRes.status === 'fulfilled') {
            setEmployees(empRes.value?.data ?? []);
            setEmployeeTotal(empRes.value?.total ?? 0);
        }
        setLoading(false);
        return () => { cancelled = true; };
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleEdit = async (data: Partial<Department>) => {
        if (!id || !department) return;
        try {
            await departmentsApi.update(id, data);
            setDepartment(prev => prev ? { ...prev, ...data } : prev);
            setShowEditModal(false);
            toast.success('Department updated successfully');
            recordActivity({ eventType: 'people.department.updated', eventCategory: 'identity', description: `Department ${data.name || department.name} was updated`, resourceType: 'department', resourceId: id }).catch(() => {});
        } catch {
            toast.error('Failed to update department');
        }
    };

    const handleAssignManager = async (personId: string) => {
        if (!id || !department) return;
        try {
            const updated = await departmentsApi.update(id, { head_person_id: personId });
            setDepartment(prev => prev ? { ...prev, ...updated } : prev);
            setShowAssignManagerModal(false);
            toast.success('Department manager assigned successfully');
            recordActivity({ eventType: 'people.department.updated', eventCategory: 'identity', description: `Department manager updated for ${department.name}`, resourceType: 'department', resourceId: id }).catch(() => {});
        } catch {
            toast.error('Failed to assign manager');
        }
    };

    const loadScopeGrantees = useCallback(async () => {
        if (!id) return;
        const orgId = apiContext.getOrgId();
        if (!orgId) return;
        setLoadingScopes(true);
        try {
            const grantees = await departmentScopeApi.listForDepartment(orgId, id);
            setScopeGrantees(grantees);
        } catch {
            setScopeGrantees([]);
        } finally {
            setLoadingScopes(false);
        }
    }, [id]);

    useEffect(() => {
        if (activeTab === 'access') {
            loadScopeGrantees();
        }
    }, [activeTab, loadScopeGrantees]);

    const handleGrantAccess = async (userId: string, includeDescendants: boolean) => {
        if (!id) return;
        const orgId = apiContext.getOrgId();
        try {
            await departmentScopeApi.grant({
                user_id: userId,
                org_id: orgId,
                department_id: id,
                include_descendants: includeDescendants,
            });
            setShowGrantAccessModal(false);
            toast.success('Department access granted');
            recordActivity({ eventType: 'people.department.access_granted', eventCategory: 'identity', description: `Department access granted for ${department?.name || id}`, resourceType: 'department', resourceId: id }).catch(() => {});
            loadScopeGrantees();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to grant access');
        }
    };

    const handleRevokeAccess = async (scopeId: string) => {
        const orgId = apiContext.getOrgId();
        try {
            await departmentScopeApi.revoke(scopeId, orgId);
            toast.success('Department access revoked');
            loadScopeGrantees();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to revoke access');
        }
    };

    const handleArchive = async () => {
        if (!id || !department) return;
        if (employeeTotal > 0) {
            toast.error(`Cannot archive department with active employee assignments. Transfer or reassign ${employeeTotal} employee(s) first.`);
            return;
        }
        try {
            await departmentsApi.update(id, { is_active: false });
            setDepartment(prev => prev ? { ...prev, is_active: false } : prev);
            toast.success('Department archived successfully');
        } catch {
            toast.error('Failed to archive department');
        }
    };

    const goBack = () => navigate('/people/departments');
    const backButton = (
        <Button variant="ghost" onClick={goBack}>
            <ArrowLeft size={16} /> Back to Departments
        </Button>
    );

    // ---------- Loading ----------
    if (loading) {
        return <DetailPageTemplate title="Department" loading>{null}</DetailPageTemplate>;
    }

    // ---------- Load failed ----------
    if (loadError === 'load_failed') {
        return (
            <PageContainer>
                <Stack gap="default">
                    {backButton}
                    <EmptyState icon={Building2} title="Failed to load department" description="Could not load department details. Please try again." action={{ label: 'Retry', onClick: () => loadData() }} />
                </Stack>
            </PageContainer>
        );
    }

    // ---------- Not found ----------
    if (loadError === 'not_found' || !department) {
        return (
            <PageContainer>
                <Stack gap="default">
                    {backButton}
                    <EmptyState icon={Building2} title="Department not found" description="This department does not exist or has been removed." action={{ label: 'Back to Departments', onClick: goBack }} />
                </Stack>
            </PageContainer>
        );
    }

    const activeEmployees = employees.filter(e => e.status === 'active').length;
    const inactiveEmployees = employeeTotal - activeEmployees;

    const TABS = [
        { id: 'overview', label: 'Overview' },
        { id: 'analytics', label: 'Analytics' },
        ...(canEdit ? [{ id: 'access', label: 'Access' }] : []),
    ];

    const employeeColumns: DataTableColumn<DepartmentEmployee>[] = [
        {
            key: 'employee',
            header: 'Employee',
            render: (emp) => (
                <Cluster gap="tight">
                    <Avatar name={emp.full_name} size="sm" />
                    <span className="text-nb-body font-medium text-fg">{emp.full_name}</span>
                </Cluster>
            ),
        },
        {
            key: 'designation',
            header: 'Designation',
            render: (emp) => (
                <Cluster gap="tight">
                    <Briefcase size={12} className="text-fg-muted" />
                    <span className="text-fg-muted">{emp.job_title || '—'}</span>
                </Cluster>
            ),
        },
        {
            key: 'email',
            header: 'Email',
            render: (emp) => emp.email ? (
                <Cluster gap="tight">
                    <Mail size={12} className="text-fg-muted" />
                    <span className="text-fg-muted">{emp.email}</span>
                </Cluster>
            ) : (
                <span className="text-fg-muted">—</span>
            ),
        },
        { key: 'status', header: 'Status', render: (emp) => <StatusBadge status={emp.status || 'inactive'} /> },
        { key: 'type', header: 'Type', render: (emp) => <span className="text-nb-caption capitalize text-fg-muted">{emp.type || '—'}</span> },
    ];

    return (
        <>
            <DetailPageTemplate
                title={department.name}
                trail={[{ label: 'Departments', onClick: goBack }]}
                status={<StatusBadge status={department.is_active ? 'active' : 'inactive'} />}
                meta={[
                    department.code,
                    department.description,
                    department.head_person ? `Head: ${department.head_person.full_name}` : null,
                    `Created ${new Date(department.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`,
                    `${employeeTotal} employees`,
                ].filter(Boolean).join(' · ')}
                secondaryActions={
                    canEdit
                        ? [
                            <Button key="edit" variant="secondary" onClick={() => setShowEditModal(true)}>
                                <Edit2 size={13} /> Edit
                            </Button>,
                            <Button key="assign" variant="secondary" onClick={() => setShowAssignManagerModal(true)}>
                                <UserPlus size={13} /> Assign Manager
                            </Button>,
                        ]
                        : undefined
                }
                overflowActions={
                    canEdit && department.is_active && canArchive
                        ? [{ label: 'Archive', icon: <Archive size={14} />, onSelect: handleArchive }]
                        : undefined
                }
                tabs={TABS}
                activeTab={activeTab}
                onTabChange={(tab: string) => setActiveTab(tab as 'overview' | 'analytics' | 'access')}
            >
                <Stack gap="region">
                    <Grid columns={5} gap="md">
                        <KpiCard label="Total Employees" value={employeeTotal} icon={Users} />
                        <KpiCard label="Active Employees" value={activeEmployees} icon={UserCheck} />
                        <KpiCard label="Inactive Employees" value={inactiveEmployees} icon={User} />
                        <KpiCard
                            label="Department Head"
                            value={department.head_person?.full_name || '—'}
                            icon={UserCheck}
                            hint={department.head_person ? 'Assigned' : 'Not assigned'}
                        />
                        <KpiCard label="Status" value={department.is_active ? 'Active' : 'Archived'} icon={Building2} />
                        <KpiCard label="Allocated Employees" value="—" icon={BarChart2} hint="Connect allocations module" />
                    </Grid>

                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <Card title="Department Members">
                            <Stack gap="default">
                                <p className="text-nb-caption text-fg-muted">{`${employeeTotal} employee${employeeTotal !== 1 ? 's' : ''} assigned`}</p>
                                <DataTable
                                    columns={employeeColumns}
                                    rows={employees}
                                    rowKey={(emp) => emp.id}
                                    onRowClick={(emp) => navigate(`/people/people/${emp.id}`)}
                                    emptyState={
                                        <EmptyState
                                            icon={Users}
                                            title="No employees in this department"
                                            description="Employees appear here automatically when their department is set in People Registry."
                                        />
                                    }
                                />
                            </Stack>
                        </Card>
                    )}

                    {/* Analytics Tab */}
                    {activeTab === 'analytics' && (
                        <Stack gap="default">
                            <Card title="Department Analytics">
                                <p className="text-nb-caption text-fg-muted">Performance and headcount insights</p>
                            </Card>
                            <Grid columns={2} gap="md">
                                {[
                                    { label: 'Headcount Trend', icon: Users },
                                    { label: 'Utilization Trend', icon: BarChart2 },
                                    { label: 'Department Cost', icon: BarChart2 },
                                    { label: 'Attendance %', icon: UserCheck },
                                    { label: 'Leave Statistics', icon: Calendar },
                                ].map(card => (
                                    <Card key={card.label}>
                                        <Stack gap="tight">
                                            <card.icon size={24} className="text-fg-muted" />
                                            <p className="text-nb-body font-medium text-fg-muted">{card.label}</p>
                                            <p className="text-nb-caption text-fg-muted">No Data Yet</p>
                                        </Stack>
                                    </Card>
                                ))}
                            </Grid>
                        </Stack>
                    )}

                    {/* Access Tab */}
                    {activeTab === 'access' && (
                        <Card
                            title="Scoped Access"
                            actions={
                                <Button onClick={() => setShowGrantAccessModal(true)}>
                                    <Shield size={16} />
                                    Grant Access
                                </Button>
                            }
                        >
                            <Stack gap="default">
                                <p className="text-nb-caption text-fg-muted">People granted visibility into this department + its sub-departments, beyond their normal role permissions</p>
                                {loadingScopes ? (
                                    <p className="text-nb-caption text-fg-muted">Loading…</p>
                                ) : scopeGrantees.length === 0 ? (
                                    <EmptyState
                                        icon={Shield}
                                        title="No one has scoped access to this department"
                                        description="Everyone's visibility is governed by their normal role permissions. Grant access to restrict someone to just this department (+ its sub-departments)."
                                        action={{ label: 'Grant Access', onClick: () => setShowGrantAccessModal(true) }}
                                    />
                                ) : (
                                    <Stack gap="tight">
                                        {scopeGrantees.map(grantee => (
                                            <Cluster key={grantee.id} justify="between">
                                                <Stack gap="tight">
                                                    <p className="text-nb-body font-medium text-fg">
                                                        {grantee.user_full_name || grantee.user_email || grantee.user_id}
                                                    </p>
                                                    <Cluster gap="default">
                                                        {grantee.user_email && (
                                                            <span className="text-nb-caption text-fg-muted">
                                                                <Mail size={11} /> {grantee.user_email}
                                                            </span>
                                                        )}
                                                        <span className="text-nb-caption text-fg-muted">
                                                            {grantee.include_descendants ? 'Includes sub-departments' : 'This department only'}
                                                        </span>
                                                    </Cluster>
                                                </Stack>
                                                <Button variant="danger" size="sm" onClick={() => handleRevokeAccess(grantee.id)}>
                                                    <X size={13} /> Revoke
                                                </Button>
                                            </Cluster>
                                        ))}
                                    </Stack>
                                )}
                            </Stack>
                        </Card>
                    )}
                </Stack>
            </DetailPageTemplate>

            {/* Modals */}
            {showEditModal && department && (
                <EditDepartmentModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    department={department}
                    onSave={handleEdit}
                />
            )}

            <AssignManagerModal
                isOpen={showAssignManagerModal}
                onClose={() => setShowAssignManagerModal(false)}
                currentHeadId={department.head_person_id}
                onAssign={handleAssignManager}
            />

            <GrantAccessModal
                isOpen={showGrantAccessModal}
                onClose={() => setShowGrantAccessModal(false)}
                onGrant={handleGrantAccess}
            />
        </>
    );
};

export default DepartmentDetailPage;

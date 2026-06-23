import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, ChevronRight, Users } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import { useActivity, useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import { QuotaBar, QuotaGate } from '@so360/design-system';
import { departmentsApi, Department, CreateDepartmentPayload } from '../services/departmentsService';

const DepartmentsPage: React.FC = () => {
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreate = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:departments:create') ?? true);
    const quotaChecks = useMemo(() => [{ module_code: 'people', quota_key: 'max_departments' }], []);
    const { getQuota } = useQuota({ checks: quotaChecks, orgId: shell?.currentOrg?.id || '' });
    const quotaData = getQuota('max_departments');
    const { isSandboxMode, sandboxEntryLimit, limitItems, isLimited } = useSandboxLimit();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

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
            setToast({ message: 'Failed to load departments', type: 'error' });
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
            setToast({ message: `Department ${data.name} has been created`, type: 'success' });
            recordActivity({ eventType: 'people.department.created', eventCategory: 'identity', description: `Department ${data.name} was created`, resourceType: 'department', resourceId: created?.id }).catch(() => {});
            loadDepartments();
        } catch (error) {
            setToast({ message: 'Failed to create department', type: 'error' });
        }
    };

    const handleUpdate = async (id: string, data: Partial<Department>) => {
        try {
            await departmentsApi.update(id, data);
            setEditingDepartment(null);
            setToast({ message: 'Department updated successfully', type: 'success' });
            recordActivity({ eventType: 'people.department.updated', eventCategory: 'identity', description: `Department ${data.name || id} was updated`, resourceType: 'department', resourceId: id }).catch(() => {});
            loadDepartments();
        } catch (error) {
            setToast({ message: 'Failed to update department', type: 'error' });
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
                <div
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 hover:bg-slate-800/50 transition-all"
                    style={{ marginLeft: `${depth * 20}px` }}
                >
                    <div className="flex items-center gap-4">
                        {/* Expand/Collapse */}
                        <button
                            onClick={() => hasChildren && toggleExpand(dept.id)}
                            className={`flex-shrink-0 ${hasChildren ? 'text-slate-400 hover:text-teal-400' : 'text-slate-800'}`}
                            disabled={!hasChildren}
                        >
                            {hasChildren ? (
                                isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                            ) : (
                                <div className="w-4" />
                            )}
                        </button>

                        {/* Info — clickable area navigates to department detail */}
                        <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => navigate(`/people/departments/${dept.id}`)}
                        >
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-medium text-slate-50 truncate hover:text-teal-300 transition-colors">{dept.name}</span>
                                <span className="text-xs text-slate-500">{dept.code}</span>
                                <StatusBadge status={dept.is_active ? 'active' : 'inactive'} />
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                {dept.head_person && (
                                    <span>Head: {dept.head_person.full_name}</span>
                                )}
                                {dept.employee_count !== undefined && (
                                    <span className="flex items-center gap-1">
                                        <Users size={12} />
                                        {dept.employee_count} employees
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        {canCreate && <button
                            onClick={() => setEditingDepartment(dept)}
                            className="px-3 py-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                        >
                            Edit
                        </button>}
                    </div>
                </div>

                {/* Children */}
                {hasChildren && isExpanded && dept.children?.map(child => renderDepartment(child, depth + 1))}
            </React.Fragment>
        );
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Departments"
                subtitle="Manage organizational structure"
                actions={
                    canCreate && <QuotaGate
                        quotaKey="max_departments"
                        moduleCode="people"
                        used={quotaData?.current_usage ?? 0}
                        limit={quotaData?.limit ?? 0}
                        isUnlimited={quotaData?.is_unlimited}
                        disableOnExceeded
                    >
                    <button
                        onClick={() => setShowCreateModal(true)}
                        disabled={isSandboxMode}
                        title={isSandboxMode ? 'Not available in Sandbox mode' : undefined}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <Building2 size={16} />
                        Create Department
                    </button>
                    </QuotaGate>
                }
            />

            {quotaData && (
                <QuotaBar
                    label="Departments"
                    used={quotaData.current_usage}
                    limit={quotaData.limit}
                    isUnlimited={quotaData.is_unlimited}
                />
            )}

            {isSandboxMode && isLimited(departments.length) && (
                <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-400 text-sm">
                    <span className="font-semibold">Sandbox:</span>
                    <span>Showing {sandboxEntryLimit} of {departments.length} records. Switch to Production to view all.</span>
                </div>
            )}

            {/* Departments Tree */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : departments.length === 0 ? (
                <EmptyState
                    icon={Building2}
                    title="No departments found"
                    description="Create your first department to organize your team."
                    action={canCreate ? { label: 'Create Department', onClick: () => setShowCreateModal(true) } : undefined}
                />
            ) : (
                <div className="space-y-2">
                    {(isSandboxMode ? departments.slice(0, sandboxEntryLimit) : departments).map(dept => renderDepartment(dept))}
                </div>
            )}

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

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
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

    useEffect(() => {
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code || !formData.name) return;

        if (department) {
            onUpdate(department.id, formData);
        } else {
            onCreate(formData);
        }
    };

    const updateField = (field: keyof CreateDepartmentPayload, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={department ? 'Edit Department' : 'Create Department'}>
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Code *</label>
                        <input
                            type="text"
                            required
                            value={formData.code}
                            onChange={(e) => updateField('code', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            placeholder="ENG"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Name *</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => updateField('name', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            placeholder="Engineering"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Description</label>
                    <textarea
                        value={formData.description || ''}
                        onChange={(e) => updateField('description', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        rows={3}
                        placeholder="Department description..."
                    />
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Parent Department</label>
                    <select
                        value={formData.parent_id || ''}
                        onChange={(e) => updateField('parent_id', e.target.value || undefined)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                    >
                        <option value="">None (Top Level)</option>
                        {departments.map(dept => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => updateField('is_active', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                    />
                    <label htmlFor="is_active" className="text-sm text-slate-300">Active</label>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        {department ? 'Update' : 'Create'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default DepartmentsPage;

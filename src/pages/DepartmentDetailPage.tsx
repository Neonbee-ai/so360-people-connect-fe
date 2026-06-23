import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Building2, Users, UserCheck, User,
    Calendar, Edit2, UserPlus, Archive, BarChart2,
    Mail, Briefcase,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import EmptyState from '../components/EmptyState';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { departmentsApi, Department, DepartmentEmployee } from '../services/departmentsService';
import { peopleApi } from '../services/peopleService';
import type { Person } from '../types/people';

// =============================================================================
// Summary Card
// =============================================================================

interface SummaryCardProps {
    label: string;
    value: string | number;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    sub?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, icon: Icon, sub }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-2xl font-semibold text-slate-50">{value}</p>
                {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
            </div>
            {Icon && (
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                    <Icon size={16} className="text-teal-400" />
                </div>
            )}
        </div>
    </div>
);

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
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Code *</label>
                        <input
                            type="text"
                            required
                            value={form.code}
                            onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Name *</label>
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Description</label>
                    <textarea
                        value={form.description}
                        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="edit_is_active"
                        checked={form.is_active}
                        onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600"
                    />
                    <label htmlFor="edit_is_active" className="text-sm text-slate-300">Active</label>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">
                        Save Changes
                    </button>
                </div>
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
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-slate-400">Select a person from the People Registry to assign as Department Head.</p>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Search</label>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name..."
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Select Manager *</label>
                    {loading ? (
                        <div className="h-10 bg-slate-800 rounded-lg animate-pulse" />
                    ) : (
                        <select
                            required
                            value={selectedId}
                            onChange={e => setSelectedId(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        >
                            <option value="">Select a person</option>
                            {filtered.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.full_name}{p.job_title ? ` — ${p.job_title}` : ''}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!selectedId}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        Assign Manager
                    </button>
                </div>
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
    const canEdit = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:departments:create') ?? true);

    const [department, setDepartment] = useState<Department | null>(null);
    const [employees, setEmployees] = useState<DepartmentEmployee[]>([]);
    const [employeeTotal, setEmployeeTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<'not_found' | 'load_failed' | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');
    const [showEditModal, setShowEditModal] = useState(false);
    const [showAssignManagerModal, setShowAssignManagerModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

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
            setToast({ message: 'Department updated successfully', type: 'success' });
            recordActivity({ eventType: 'people.department.updated', eventCategory: 'identity', description: `Department ${data.name || department.name} was updated`, resourceType: 'department', resourceId: id }).catch(() => {});
        } catch {
            setToast({ message: 'Failed to update department', type: 'error' });
        }
    };

    const handleAssignManager = async (personId: string) => {
        if (!id || !department) return;
        try {
            const updated = await departmentsApi.update(id, { head_person_id: personId });
            setDepartment(prev => prev ? { ...prev, ...updated } : prev);
            setShowAssignManagerModal(false);
            setToast({ message: 'Department manager assigned successfully', type: 'success' });
            recordActivity({ eventType: 'people.department.updated', eventCategory: 'identity', description: `Department manager updated for ${department.name}`, resourceType: 'department', resourceId: id }).catch(() => {});
        } catch {
            setToast({ message: 'Failed to assign manager', type: 'error' });
        }
    };

    const handleArchive = async () => {
        if (!id || !department) return;
        if (employeeTotal > 0) {
            setToast({ message: `Cannot archive department with active employee assignments. Transfer or reassign ${employeeTotal} employee(s) first.`, type: 'error' });
            return;
        }
        try {
            await departmentsApi.update(id, { is_active: false });
            setDepartment(prev => prev ? { ...prev, is_active: false } : prev);
            setToast({ message: 'Department archived successfully', type: 'success' });
        } catch {
            setToast({ message: 'Failed to archive department', type: 'error' });
        }
    };

    // ---------- Loading ----------
    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-800 rounded-lg animate-pulse" />
                    <div className="h-7 w-48 bg-slate-800 rounded animate-pulse" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-slate-800/50 rounded-xl animate-pulse" />)}
                </div>
                <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
            </div>
        );
    }

    // ---------- Load failed ----------
    if (loadError === 'load_failed') {
        return (
            <div className="p-6">
                <button onClick={() => navigate('/people/departments')} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-50 mb-6 transition-colors">
                    <ArrowLeft size={16} /> Back to Departments
                </button>
                <EmptyState icon={Building2} title="Failed to load department" description="Could not load department details. Please try again." action={{ label: 'Retry', onClick: () => loadData() }} />
            </div>
        );
    }

    // ---------- Not found ----------
    if (loadError === 'not_found' || !department) {
        return (
            <div className="p-6">
                <button onClick={() => navigate('/people/departments')} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-50 mb-6 transition-colors">
                    <ArrowLeft size={16} /> Back to Departments
                </button>
                <EmptyState icon={Building2} title="Department not found" description="This department does not exist or has been removed." action={{ label: 'Back to Departments', onClick: () => navigate('/people/departments') }} />
            </div>
        );
    }

    const activeEmployees = employees.filter(e => e.status === 'active').length;
    const inactiveEmployees = employeeTotal - activeEmployees;

    const TABS = [
        { key: 'overview', label: 'Overview' },
        { key: 'analytics', label: 'Analytics' },
    ] as const;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate('/people/departments')}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-50 mb-4 transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Departments
                </button>

                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                            <Building2 size={22} className="text-teal-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h1 className="text-xl font-semibold text-slate-50">{department.name}</h1>
                                <span className="text-sm text-slate-500 font-mono">{department.code}</span>
                                <StatusBadge status={department.is_active ? 'active' : 'inactive'} />
                            </div>
                            {department.description && (
                                <p className="text-sm text-slate-400 mb-1">{department.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                {department.head_person && (
                                    <span className="flex items-center gap-1">
                                        <User size={11} /> Head: {department.head_person.full_name}
                                    </span>
                                )}
                                <span className="flex items-center gap-1">
                                    <Calendar size={11} /> Created {new Date(department.created_at).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Users size={11} /> {employeeTotal} employees
                                </span>
                            </div>
                        </div>
                    </div>

                    {canEdit && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-slate-50 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
                            >
                                <Edit2 size={13} /> Edit
                            </button>
                            <button
                                onClick={() => setShowAssignManagerModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-slate-50 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
                            >
                                <UserPlus size={13} /> Assign Manager
                            </button>
                            {department.is_active && (
                                <button
                                    onClick={handleArchive}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 rounded-lg transition-colors"
                                >
                                    <Archive size={13} /> Archive
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <SummaryCard label="Total Employees" value={employeeTotal} icon={Users} />
                <SummaryCard label="Active Employees" value={activeEmployees} icon={UserCheck} />
                <SummaryCard label="Inactive Employees" value={inactiveEmployees} icon={User} />
                <SummaryCard
                    label="Department Head"
                    value={department.head_person?.full_name || '—'}
                    icon={UserCheck}
                    sub={department.head_person ? 'Assigned' : 'Not assigned'}
                />
                <SummaryCard label="Status" value={department.is_active ? 'Active' : 'Archived'} icon={Building2} />
                <SummaryCard label="Allocated Employees" value="—" icon={BarChart2} sub="Connect allocations module" />
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-800">
                <div className="flex gap-6">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                                activeTab === tab.key
                                    ? 'text-teal-400 border-teal-400'
                                    : 'text-slate-500 border-transparent hover:text-slate-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-4">
                    <PageHeader title="Department Members" subtitle={`${employeeTotal} employee${employeeTotal !== 1 ? 's' : ''} assigned`} />

                    {employees.length === 0 ? (
                        <EmptyState
                            icon={Users}
                            title="No employees in this department"
                            description="Employees appear here automatically when their department is set in People Registry."
                        />
                    ) : (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Employee</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Designation</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {employees.map(emp => (
                                        <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-xs font-medium text-teal-400">
                                                            {emp.full_name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span className="font-medium text-slate-50">{emp.full_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5 text-slate-400">
                                                    <Briefcase size={12} />
                                                    {emp.job_title || '—'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {emp.email ? (
                                                    <div className="flex items-center gap-1.5 text-slate-400">
                                                        <Mail size={12} />
                                                        {emp.email}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-600">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={emp.status || 'inactive'} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs capitalize text-slate-400">{emp.type || '—'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => navigate(`/people/people/${emp.id}`)}
                                                    className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                                                >
                                                    View Profile
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
                <div className="space-y-4">
                    <PageHeader title="Department Analytics" subtitle="Performance and headcount insights" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { label: 'Headcount Trend', icon: Users },
                            { label: 'Utilization Trend', icon: BarChart2 },
                            { label: 'Department Cost', icon: BarChart2 },
                            { label: 'Attendance %', icon: UserCheck },
                            { label: 'Leave Statistics', icon: Calendar },
                        ].map(card => (
                            <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-[140px] gap-3">
                                <card.icon size={24} className="text-slate-600" />
                                <div className="text-center">
                                    <p className="text-sm font-medium text-slate-400">{card.label}</p>
                                    <p className="text-xs text-slate-600 mt-1">No Data Yet</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default DepartmentDetailPage;

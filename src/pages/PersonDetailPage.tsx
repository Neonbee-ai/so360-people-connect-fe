import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Mail, Phone, Calendar, DollarSign, Clock, Target,
    Tag, Plus, Trash2, Edit2, Save, X,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import { peopleApi, allocationsApi, timeEntriesApi } from '../services/peopleService';
import type { Person, Allocation, TimeEntry, PersonRole } from '../types/people';

const PersonDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [person, setPerson] = useState<Person | null>(null);
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Person>>({});
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    useEffect(() => {
        if (!id) return;
        const loadData = async () => {
            try {
                const [personData, allocData, timeData] = await Promise.all([
                    peopleApi.getById(id),
                    allocationsApi.getAll({ person_id: id }),
                    timeEntriesApi.getAll({ person_id: id, limit: 10 }),
                ]);
                setPerson(personData);
                setAllocations(allocData.data);
                setTimeEntries(timeData.data);
            } catch (error) {
                console.error('Failed to load person:', error);
                setToast({ message: 'Failed to load person details', type: 'error' });
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id]);

    const handleSave = async () => {
        if (!id || !person) return;
        try {
            const updated = await peopleApi.update(id, editData);
            setPerson({ ...person, ...updated });
            setEditing(false);
            setToast({ message: 'Person updated', type: 'success' });
        } catch (error) {
            setToast({ message: 'Failed to update', type: 'error' });
        }
    };

    const handleAddRole = async (roleData: { role_name: string; skill_category: string; proficiency: string; is_primary: boolean }) => {
        if (!id) return;
        try {
            const newRole = await peopleApi.addRole(id, roleData as Omit<PersonRole, 'id' | 'person_id' | 'org_id' | 'tenant_id' | 'created_at'>);
            setPerson(prev => prev ? { ...prev, people_roles: [...(prev.people_roles || []), newRole] } : prev);
            setShowRoleModal(false);
            setToast({ message: 'Role added', type: 'success' });
        } catch (error) {
            setToast({ message: 'Failed to add role', type: 'error' });
        }
    };

    const handleRemoveRole = async (roleId: string) => {
        if (!id) return;
        try {
            await peopleApi.removeRole(id, roleId);
            setPerson(prev => prev ? { ...prev, people_roles: prev.people_roles?.filter(r => r.id !== roleId) } : prev);
            setToast({ message: 'Role removed', type: 'success' });
        } catch (error) {
            setToast({ message: 'Failed to remove role', type: 'error' });
        }
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 w-32 bg-slate-800 rounded" />
                    <div className="h-48 bg-slate-800 rounded-xl" />
                </div>
            </div>
        );
    }

    if (!person) {
        return (
            <div className="p-6 text-center text-slate-400">
                Person not found.
                <button onClick={() => navigate('/people')} className="ml-2 text-teal-400 hover:text-teal-300">
                    Back to list
                </button>
            </div>
        );
    }

    const totalAllocated = allocations
        .filter(a => a.status === 'active')
        .reduce((sum, a) => sum + (a.allocation_type === 'percentage' ? a.allocation_value : 0), 0);

    const totalHoursLogged = timeEntries.reduce((sum, te) => sum + te.hours, 0);

    return (
        <div className="p-6 space-y-6">
            {/* Back Navigation */}
            <button onClick={() => navigate('/people')} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                <ArrowLeft size={16} />
                Back to People
            </button>

            {/* Header */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-slate-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-teal-400">
                            {person.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </span>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-xl font-bold text-white">{person.full_name}</h2>
                            <StatusBadge status={person.type} />
                            <StatusBadge status={person.status} />
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                            {person.job_title && <span>{person.job_title}</span>}
                            {person.department && <span className="text-slate-600">|</span>}
                            {person.department && <span>{person.department}</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            {person.email && <span className="flex items-center gap-1"><Mail size={12} />{person.email}</span>}
                            {person.phone && <span className="flex items-center gap-1"><Phone size={12} />{person.phone}</span>}
                            {person.start_date && <span className="flex items-center gap-1"><Calendar size={12} />Since {person.start_date}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!editing ? (
                            <button
                                onClick={() => { setEditing(true); setEditData(person); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
                            >
                                <Edit2 size={13} /> Edit
                            </button>
                        ) : (
                            <>
                                <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 rounded-lg text-xs text-white hover:bg-teal-500 transition-colors">
                                    <Save size={13} /> Save
                                </button>
                                <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white transition-colors">
                                    <X size={13} /> Cancel
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Inline Edit Fields */}
                {editing && (
                    <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Cost Rate</label>
                            <input
                                type="number" value={editData.cost_rate || 0}
                                onChange={e => setEditData(d => ({ ...d, cost_rate: parseFloat(e.target.value) }))}
                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Billing Rate</label>
                            <input
                                type="number" value={editData.billing_rate || 0}
                                onChange={e => setEditData(d => ({ ...d, billing_rate: parseFloat(e.target.value) }))}
                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Status</label>
                            <select
                                value={editData.status || 'active'}
                                onChange={e => setEditData(d => ({ ...d, status: e.target.value as Person['status'] }))}
                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-teal-500"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="on_leave">On Leave</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Hours/Day</label>
                            <input
                                type="number" value={editData.available_hours_per_day || 8}
                                onChange={e => setEditData(d => ({ ...d, available_hours_per_day: parseFloat(e.target.value) }))}
                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-teal-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <DollarSign size={14} className="text-emerald-400" />
                        <span className="text-xs text-slate-400">Cost Rate</span>
                    </div>
                    <div className="text-lg font-bold text-white">${person.cost_rate}/{person.cost_rate_unit}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Target size={14} className="text-blue-400" />
                        <span className="text-xs text-slate-400">Total Allocated</span>
                    </div>
                    <div className="text-lg font-bold text-white">{totalAllocated}%</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className="text-amber-400" />
                        <span className="text-xs text-slate-400">Hours Logged</span>
                    </div>
                    <div className="text-lg font-bold text-white">{totalHoursLogged}h</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className="text-teal-400" />
                        <span className="text-xs text-slate-400">Availability</span>
                    </div>
                    <div className="text-lg font-bold text-white">{person.available_hours_per_day}h/day</div>
                </div>
            </div>

            {/* Roles & Skills */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl">
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Tag size={14} /> Roles & Skills
                    </h3>
                    <button
                        onClick={() => setShowRoleModal(true)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
                    >
                        <Plus size={12} /> Add Role
                    </button>
                </div>
                <div className="p-5">
                    {!person.people_roles || person.people_roles.length === 0 ? (
                        <p className="text-sm text-slate-500">No roles assigned yet</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {person.people_roles.map(role => (
                                <div key={role.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg">
                                    <span className="text-sm text-white">{role.role_name}</span>
                                    {role.skill_category && <span className="text-xs text-slate-500">{role.skill_category}</span>}
                                    <StatusBadge status={role.proficiency} />
                                    {role.is_primary && <span className="text-xs text-teal-400 font-medium">Primary</span>}
                                    <button onClick={() => handleRemoveRole(role.id)} className="ml-1 text-slate-500 hover:text-rose-400">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Allocations */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl">
                <div className="px-5 py-4 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Target size={14} /> Active Allocations
                    </h3>
                </div>
                <div className="divide-y divide-slate-800">
                    {allocations.length === 0 ? (
                        <div className="p-5 text-sm text-slate-500">No allocations</div>
                    ) : (
                        allocations.map(alloc => (
                            <div key={alloc.id} className="px-5 py-3 flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-white">{alloc.entity_name || alloc.entity_id}</div>
                                    <div className="text-xs text-slate-500">
                                        {alloc.start_date} to {alloc.end_date} | {alloc.entity_type}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-white">
                                        {alloc.allocation_value}{alloc.allocation_type === 'percentage' ? '%' : 'h'}
                                    </span>
                                    <StatusBadge status={alloc.status} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Recent Time Entries */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl">
                <div className="px-5 py-4 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Clock size={14} /> Recent Time Entries
                    </h3>
                </div>
                <div className="divide-y divide-slate-800">
                    {timeEntries.length === 0 ? (
                        <div className="p-5 text-sm text-slate-500">No time entries</div>
                    ) : (
                        timeEntries.map(entry => (
                            <div key={entry.id} className="px-5 py-3 flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-white">{entry.entity_name || entry.entity_type}</div>
                                    <div className="text-xs text-slate-500">
                                        {entry.work_date} | {entry.description || 'No description'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-white">{entry.hours}h</span>
                                    <span className="text-xs text-slate-400">${entry.total_cost}</span>
                                    <StatusBadge status={entry.status} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Add Role Modal */}
            <AddRoleModal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} onAdd={handleAddRole} />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

// Add Role Modal Component
const AddRoleModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (data: { role_name: string; skill_category: string; proficiency: string; is_primary: boolean }) => void;
}> = ({ isOpen, onClose, onAdd }) => {
    const [roleName, setRoleName] = useState('');
    const [category, setCategory] = useState('');
    const [proficiency, setProficiency] = useState('intermediate');
    const [isPrimary, setIsPrimary] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!roleName) return;
        onAdd({ role_name: roleName, skill_category: category, proficiency, is_primary: isPrimary });
        setRoleName(''); setCategory(''); setProficiency('intermediate'); setIsPrimary(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Role / Skill" size="sm">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Role Name *</label>
                    <input type="text" required value={roleName} onChange={e => setRoleName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        placeholder="e.g., Full Stack Developer" />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Skill Category</label>
                    <input type="text" value={category} onChange={e => setCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        placeholder="e.g., Engineering, Design" />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Proficiency</label>
                    <select value={proficiency} onChange={e => setProficiency(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500">
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="expert">Expert</option>
                    </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)}
                        className="rounded border-slate-600" />
                    Primary role
                </label>
                <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-400 hover:text-white">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg">Add Role</button>
                </div>
            </form>
        </Modal>
    );
};

export default PersonDetailPage;

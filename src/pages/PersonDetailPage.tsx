import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Mail, Phone, Calendar, DollarSign, Clock, Target,
    Tag, Plus, Trash2, Edit2, Save, X, History, User, UserCheck, UserPlus,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import EmptyState from '../components/EmptyState';
import { useActivity } from '@so360/shell-context';
import { peopleApi, allocationsApi, timeEntriesApi } from '../services/peopleService';
import { goalsApi, Goal } from '../services/goalsService';
import { workLocationsApi, WorkLocation } from '../services/workLocationsService';
import type { Person, Allocation, TimeEntry, PersonRole } from '../types/people';

const PersonDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const [person, setPerson] = useState<Person | null>(null);
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [employmentHistory, setEmploymentHistory] = useState<any[]>([]);
    const [rateHistory, setRateHistory] = useState<any[]>([]);
    const [goals, setGoals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Person>>({});
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [showLinkUserModal, setShowLinkUserModal] = useState(false);
    const [showUpdateRateModal, setShowUpdateRateModal] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('overview');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);

    useEffect(() => {
        if (!id) return;
        const loadData = async () => {
            try {
                const [personData, allocData, timeData, locData] = await Promise.all([
                    peopleApi.getById(id),
                    allocationsApi.getAll({ person_id: id }),
                    timeEntriesApi.getAll({ person_id: id, limit: 10 }),
                    workLocationsApi.getAll(),
                ]);
                setPerson(personData);
                setAllocations(allocData.data);
                setTimeEntries(timeData.data);
                setWorkLocations(locData.data);
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
            const statusChanged = editData.status && editData.status !== person.status;
            if (statusChanged) {
                recordActivity({ eventType: 'people.person.status_changed', eventCategory: 'identity', description: `Person ${person.full_name} status changed to ${editData.status}`, resourceType: 'person', resourceId: id }).catch(() => {});
            } else {
                recordActivity({ eventType: 'people.person.updated', eventCategory: 'identity', description: `Person ${person.full_name} was updated`, resourceType: 'person', resourceId: id }).catch(() => {});
            }
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

    const loadEmploymentHistory = async () => {
        if (!id) return;
        try {
            const data = await peopleApi.getEmploymentHistory(id);
            setEmploymentHistory(data);
        } catch (error) {
            console.error('Failed to load employment history:', error);
        }
    };

    const loadRateHistory = async () => {
        if (!id) return;
        try {
            const data = await peopleApi.getRateHistory(id);
            setRateHistory(data);
        } catch (error) {
            console.error('Failed to load rate history:', error);
        }
    };

    const loadGoals = async () => {
        if (!id || !person) return;
        try {
            const data = await goalsApi.getAll({ person_id: id });
            setGoals(data.data || []);
        } catch (error) {
            console.error('Failed to load goals:', error);
            setGoals([]);
        }
    };

    useEffect(() => {
        if (!person) return;
        if (activeTab === 'employment-history') {
            loadEmploymentHistory();
        } else if (activeTab === 'rate-history') {
            loadRateHistory();
        } else if (activeTab === 'goals') {
            loadGoals();
        }
    }, [activeTab, person]);

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
                            {person.user_id && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-500/10 border border-teal-500/30 rounded-md text-xs text-teal-400">
                                    <UserCheck size={12} />
                                    Linked to user account
                                </span>
                            )}
                            {!person.user_id && (
                                <button
                                    onClick={() => setShowLinkUserModal(true)}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-xs text-slate-400 hover:text-slate-50 transition-colors"
                                >
                                    <UserPlus size={12} />
                                    Link User
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                            {person.job_title && <span>{person.job_title}</span>}
                            {person.department && <span className="text-slate-600">|</span>}
                            {person.department && <span>{person.department}</span>}
                            {person.work_location && (
                                <>
                                    <span className="text-slate-600">|</span>
                                    <span className="flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                        {person.work_location.name}
                                    </span>
                                </>
                            )}
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
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-slate-50 hover:border-slate-600 transition-colors"
                            >
                                <Edit2 size={13} /> Edit
                            </button>
                        ) : (
                            <>
                                <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 rounded-lg text-xs text-white hover:bg-teal-500 transition-colors">
                                    <Save size={13} /> Save
                                </button>
                                <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-slate-50 transition-colors">
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
                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Billing Rate</label>
                            <input
                                type="number" value={editData.billing_rate || 0}
                                onChange={e => setEditData(d => ({ ...d, billing_rate: parseFloat(e.target.value) }))}
                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Status</label>
                            <select
                                value={editData.status || 'active'}
                                onChange={e => setEditData(d => ({ ...d, status: e.target.value as Person['status'] }))}
                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-50 focus:outline-none focus:border-teal-500"
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
                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Work Location</label>
                            <select
                                value={editData.work_location_id || ''}
                                onChange={e => setEditData(d => ({ ...d, work_location_id: e.target.value || undefined }))}
                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                <option value="">None</option>
                                {workLocations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                ))}
                            </select>
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
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-slate-50 hover:border-slate-600 transition-colors"
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

            {/* Tabs */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl">
                <div className="border-b border-slate-800">
                    <div className="flex items-center gap-1 px-5 py-3">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'overview'
                                    ? 'bg-teal-500/10 text-teal-400'
                                    : 'text-slate-400 hover:text-slate-50 hover:bg-slate-800'
                            }`}
                        >
                            <User size={14} className="inline mr-1.5" />
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('allocations')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'allocations'
                                    ? 'bg-teal-500/10 text-teal-400'
                                    : 'text-slate-400 hover:text-slate-50 hover:bg-slate-800'
                            }`}
                        >
                            <Target size={14} className="inline mr-1.5" />
                            Allocations
                        </button>
                        <button
                            onClick={() => setActiveTab('time')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'time'
                                    ? 'bg-teal-500/10 text-teal-400'
                                    : 'text-slate-400 hover:text-slate-50 hover:bg-slate-800'
                            }`}
                        >
                            <Clock size={14} className="inline mr-1.5" />
                            Time Entries
                        </button>
                        <button
                            onClick={() => setActiveTab('employment-history')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'employment-history'
                                    ? 'bg-teal-500/10 text-teal-400'
                                    : 'text-slate-400 hover:text-slate-50 hover:bg-slate-800'
                            }`}
                        >
                            <History size={14} className="inline mr-1.5" />
                            Employment History
                        </button>
                        <button
                            onClick={() => setActiveTab('rate-history')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'rate-history'
                                    ? 'bg-teal-500/10 text-teal-400'
                                    : 'text-slate-400 hover:text-slate-50 hover:bg-slate-800'
                            }`}
                        >
                            <DollarSign size={14} className="inline mr-1.5" />
                            Rate History
                        </button>
                        <button
                            onClick={() => setActiveTab('goals')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'goals'
                                    ? 'bg-teal-500/10 text-teal-400'
                                    : 'text-slate-400 hover:text-slate-50 hover:bg-slate-800'
                            }`}
                        >
                            <Target size={14} className="inline mr-1.5" />
                            Goals
                        </button>
                    </div>
                </div>

                <div className="p-5">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="space-y-4">
                            <div className="text-sm text-slate-400">
                                <p className="mb-2">This is the overview of {person.full_name}'s profile.</p>
                                <p>Use the tabs above to view allocations, time entries, employment history, rate changes, and goals.</p>
                            </div>
                        </div>
                    )}

                    {/* Allocations Tab */}
                    {activeTab === 'allocations' && (
                        <div className="space-y-3">
                            {allocations.length === 0 ? (
                                <EmptyState
                                    icon={Target}
                                    title="No allocations"
                                    description="Project allocations for this person will appear here"
                                />
                            ) : (
                                allocations.map(alloc => (
                                    <div key={alloc.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                        <div className="flex items-center justify-between">
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
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Time Entries Tab */}
                    {activeTab === 'time' && (
                        <div className="space-y-3">
                            {timeEntries.length === 0 ? (
                                <EmptyState
                                    icon={Clock}
                                    title="No time entries"
                                    description="Time entries logged by this person will appear here"
                                />
                            ) : (
                                timeEntries.map(entry => (
                                    <div key={entry.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                        <div className="flex items-center justify-between">
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
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Employment History Tab */}
                    {activeTab === 'employment-history' && (
                        <div className="space-y-3">
                            {employmentHistory.map((event) => (
                                <div key={event.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium text-white capitalize">{event.event_type.replace('_', ' ')}</span>
                                                <StatusBadge status={event.event_type} />
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {new Date(event.effective_date).toLocaleDateString()}
                                            </div>
                                            {event.notes && (
                                                <div className="mt-2 text-sm text-slate-400">{event.notes}</div>
                                            )}
                                            {event.new_department_id && (
                                                <div className="mt-1 text-xs text-slate-500">
                                                    Department: {event.new_department_name || event.new_department_id}
                                                </div>
                                            )}
                                            {event.new_job_title && (
                                                <div className="mt-1 text-xs text-slate-500">
                                                    Title: {event.new_job_title}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-600">
                                            {new Date(event.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {employmentHistory.length === 0 && (
                                <EmptyState
                                    icon={History}
                                    title="No employment history"
                                    description="Employment changes will appear here"
                                />
                            )}
                        </div>
                    )}

                    {/* Rate History Tab */}
                    {activeTab === 'rate-history' && (
                        <div className="space-y-3">
                            {rateHistory.map((event) => (
                                <div key={event.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div>
                                                    <div className="text-xs text-slate-500">Cost Rate</div>
                                                    <div className="text-lg font-medium text-white">
                                                        ${event.new_cost_rate}/{person.cost_rate_unit}
                                                    </div>
                                                </div>
                                                {event.new_billing_rate && (
                                                    <div>
                                                        <div className="text-xs text-slate-500">Billing Rate</div>
                                                        <div className="text-lg font-medium text-teal-400">
                                                            ${event.new_billing_rate}/{person.cost_rate_unit}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                Effective: {new Date(event.effective_date).toLocaleDateString()}
                                            </div>
                                            {event.reason && (
                                                <div className="mt-2 text-sm text-slate-400">{event.reason}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {rateHistory.length === 0 && (
                                <EmptyState
                                    icon={DollarSign}
                                    title="No rate history"
                                    description="Rate changes will appear here"
                                />
                            )}
                            <button
                                onClick={() => setShowUpdateRateModal(true)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-50 transition-colors"
                            >
                                <DollarSign size={16} />
                                Update Rate
                            </button>
                        </div>
                    )}

                    {/* Goals Tab */}
                    {activeTab === 'goals' && (
                        <div className="space-y-3">
                            {goals.map((goal) => (
                                <div key={goal.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium text-white">{goal.title}</span>
                                                <StatusBadge status={goal.status} />
                                                <StatusBadge status={goal.goal_type} />
                                            </div>
                                            {goal.description && (
                                                <div className="text-xs text-slate-500 mt-1">{goal.description}</div>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-600">
                                            Due: {new Date(goal.target_date).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-900 rounded-full h-2">
                                        <div
                                            className="bg-teal-500 h-2 rounded-full transition-all"
                                            style={{ width: `${goal.progress_percentage}%` }}
                                        />
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">{goal.progress_percentage}% complete</div>
                                </div>
                            ))}
                            {goals.length === 0 && (
                                <EmptyState
                                    icon={Target}
                                    title="No goals"
                                    description="Goals assigned to this person will appear here"
                                />
                            )}
                        </div>
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
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        placeholder="e.g., Full Stack Developer" />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Skill Category</label>
                    <input type="text" value={category} onChange={e => setCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        placeholder="e.g., Engineering, Design" />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Proficiency</label>
                    <select value={proficiency} onChange={e => setProficiency(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500">
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

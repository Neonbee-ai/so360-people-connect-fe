import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Search, Filter, Mail, Phone, Briefcase } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import { peopleApi } from '../services/peopleService';
import type { Person, CreatePersonPayload, PersonStatus } from '../types/people';

const PeoplePage: React.FC = () => {
    const navigate = useNavigate();
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const loadPeople = useCallback(async () => {
        try {
            setLoading(true);
            const result = await peopleApi.getAll({
                search: search || undefined,
                status: statusFilter || undefined,
                type: typeFilter || undefined,
            });
            setPeople(result.data);
        } catch (error) {
            console.error('Failed to load people:', error);
            setToast({ message: 'Failed to load people', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter, typeFilter]);

    useEffect(() => {
        loadPeople();
    }, [loadPeople]);

    const handleCreate = async (data: CreatePersonPayload) => {
        try {
            await peopleApi.create(data);
            setShowCreateModal(false);
            setToast({ message: `${data.full_name} has been added`, type: 'success' });
            loadPeople();
        } catch (error) {
            setToast({ message: 'Failed to create person', type: 'error' });
        }
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="People Registry"
                subtitle="Manage people as costed, allocatable resources"
                actions={
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <UserPlus size={16} />
                        Add Person
                    </button>
                }
            />

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or title..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On Leave</option>
                    <option value="terminated">Terminated</option>
                </select>
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Types</option>
                    <option value="employee">Employee</option>
                    <option value="contractor">Contractor</option>
                </select>
            </div>

            {/* People List */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : people.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="No people found"
                    description="Add people to start tracking resource allocation and utilization."
                    action={{ label: 'Add First Person', onClick: () => setShowCreateModal(true) }}
                />
            ) : (
                <div className="space-y-2">
                    {people.map((person) => (
                        <div
                            key={person.id}
                            onClick={() => navigate(`/people/${person.id}`)}
                            className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer transition-all"
                        >
                            <div className="flex items-center gap-4">
                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-slate-700 flex items-center justify-center flex-shrink-0">
                                    {person.avatar_url ? (
                                        <img src={person.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                                    ) : (
                                        <span className="text-sm font-medium text-teal-400">
                                            {person.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                        </span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm font-medium text-white truncate">{person.full_name}</span>
                                        <StatusBadge status={person.type} />
                                        <StatusBadge status={person.status} />
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                        {person.job_title && (
                                            <span className="flex items-center gap-1">
                                                <Briefcase size={12} />
                                                {person.job_title}
                                            </span>
                                        )}
                                        {person.email && (
                                            <span className="flex items-center gap-1">
                                                <Mail size={12} />
                                                {person.email}
                                            </span>
                                        )}
                                        {person.department && (
                                            <span className="text-slate-600">{person.department}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Cost Info */}
                                <div className="text-right flex-shrink-0">
                                    <div className="text-sm font-medium text-white">
                                        ${person.cost_rate}/{person.cost_rate_unit}
                                    </div>
                                    {person.billing_rate && person.billing_rate > 0 && (
                                        <div className="text-xs text-slate-500">
                                            Bill: ${person.billing_rate}/{person.cost_rate_unit}
                                        </div>
                                    )}
                                </div>

                                {/* Roles */}
                                <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
                                    {person.people_roles?.slice(0, 2).map((role) => (
                                        <span key={role.id} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-400">
                                            {role.role_name}
                                        </span>
                                    ))}
                                    {person.people_roles && person.people_roles.length > 2 && (
                                        <span className="text-xs text-slate-600">+{person.people_roles.length - 2}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            <CreatePersonModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreate}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

// =============================================================================
// Create Person Modal
// =============================================================================

interface CreatePersonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreatePersonPayload) => void;
}

const CreatePersonModal: React.FC<CreatePersonModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [formData, setFormData] = useState<CreatePersonPayload>({
        full_name: '',
        email: '',
        phone: '',
        type: 'employee',
        department: '',
        job_title: '',
        cost_rate: 0,
        cost_rate_unit: 'hour',
        currency: 'USD',
        billing_rate: 0,
        available_hours_per_day: 8,
        available_days_per_week: 5,
        start_date: new Date().toISOString().split('T')[0],
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.full_name || !formData.type) return;
        onCreate(formData);
        // Reset form
        setFormData({
            full_name: '', email: '', phone: '', type: 'employee',
            department: '', job_title: '', cost_rate: 0, cost_rate_unit: 'hour',
            currency: 'USD', billing_rate: 0, available_hours_per_day: 8,
            available_days_per_week: 5, start_date: new Date().toISOString().split('T')[0],
        });
    };

    const updateField = (field: string, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Person" size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Basic Info */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Identity</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs text-slate-400 mb-1">Full Name *</label>
                            <input
                                type="text" required value={formData.full_name}
                                onChange={(e) => updateField('full_name', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                                placeholder="John Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Email</label>
                            <input
                                type="email" value={formData.email || ''}
                                onChange={(e) => updateField('email', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                                placeholder="john@company.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Phone</label>
                            <input
                                type="text" value={formData.phone || ''}
                                onChange={(e) => updateField('phone', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                                placeholder="+1-555-0100"
                            />
                        </div>
                    </div>
                </div>

                {/* Classification */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Classification</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Type *</label>
                            <select
                                value={formData.type}
                                onChange={(e) => updateField('type', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            >
                                <option value="employee">Employee</option>
                                <option value="contractor">Contractor</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Department</label>
                            <input
                                type="text" value={formData.department || ''}
                                onChange={(e) => updateField('department', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                                placeholder="Engineering"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Job Title</label>
                            <input
                                type="text" value={formData.job_title || ''}
                                onChange={(e) => updateField('job_title', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                                placeholder="Senior Developer"
                            />
                        </div>
                    </div>
                </div>

                {/* Cost */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Cost & Billing</h4>
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Cost Rate *</label>
                            <input
                                type="number" min="0" step="0.01" value={formData.cost_rate}
                                onChange={(e) => updateField('cost_rate', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Rate Unit</label>
                            <select
                                value={formData.cost_rate_unit}
                                onChange={(e) => updateField('cost_rate_unit', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            >
                                <option value="hour">Per Hour</option>
                                <option value="day">Per Day</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Billing Rate</label>
                            <input
                                type="number" min="0" step="0.01" value={formData.billing_rate || 0}
                                onChange={(e) => updateField('billing_rate', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Currency</label>
                            <select
                                value={formData.currency}
                                onChange={(e) => updateField('currency', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            >
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                                <option value="INR">INR</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Availability */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Availability</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Hours/Day</label>
                            <input
                                type="number" min="1" max="24" value={formData.available_hours_per_day}
                                onChange={(e) => updateField('available_hours_per_day', parseFloat(e.target.value) || 8)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Days/Week</label>
                            <input
                                type="number" min="1" max="7" value={formData.available_days_per_week}
                                onChange={(e) => updateField('available_days_per_week', parseInt(e.target.value) || 5)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                            <input
                                type="date" value={formData.start_date || ''}
                                onChange={(e) => updateField('start_date', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button
                        type="button" onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        Add Person
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default PeoplePage;

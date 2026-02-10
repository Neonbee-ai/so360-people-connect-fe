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
import Toast, { ToastType } from '../components/Toast';
import { allocationsApi, peopleApi } from '../services/peopleService';
import type { Allocation, CreateAllocationPayload, Person, AllocationStatus } from '../types/people';

const AllocationsPage: React.FC = () => {
    const navigate = useNavigate();
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const loadAllocations = useCallback(async () => {
        try {
            setLoading(true);
            const result = await allocationsApi.getAll({
                status: statusFilter || undefined,
                entity_type: entityTypeFilter || undefined,
            });
            setAllocations(result.data);
        } catch (error) {
            console.error('Failed to load allocations:', error);
            setToast({ message: 'Failed to load allocations', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [statusFilter, entityTypeFilter]);

    useEffect(() => {
        loadAllocations();
    }, [loadAllocations]);

    const handleCreate = async (data: CreateAllocationPayload) => {
        try {
            await allocationsApi.create(data);
            setShowCreateModal(false);
            setToast({ message: 'Allocation created successfully', type: 'success' });
            loadAllocations();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to create allocation';
            setToast({ message: msg, type: 'error' });
        }
    };

    const handleUpdate = async (id: string, data: Partial<Allocation>) => {
        try {
            await allocationsApi.update(id, data);
            setEditingAllocation(null);
            setToast({ message: 'Allocation updated', type: 'success' });
            loadAllocations();
        } catch (error) {
            setToast({ message: 'Failed to update allocation', type: 'error' });
        }
    };

    const handleCancel = async (id: string) => {
        if (!confirm('Cancel this allocation? This action cannot be undone.')) return;
        try {
            await allocationsApi.cancel(id);
            setToast({ message: 'Allocation cancelled', type: 'success' });
            loadAllocations();
        } catch (error) {
            setToast({ message: 'Failed to cancel allocation', type: 'error' });
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
        if (alloc.status === 'active' && alloc.allocation_type === 'percentage') {
            acc[personId].totalPct += alloc.allocation_value;
        }
        return acc;
    }, {});

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Allocations"
                subtitle="Assign people to execution entities with capacity control"
                actions={
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <Plus size={16} />
                        New Allocation
                    </button>
                }
            />

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Statuses</option>
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <select
                    value={entityTypeFilter}
                    onChange={(e) => setEntityTypeFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Entity Types</option>
                    <option value="project">Project</option>
                    <option value="task">Task</option>
                    <option value="work_order">Work Order</option>
                    <option value="engagement">Engagement</option>
                </select>

                {/* Summary Stats */}
                <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
                    <span>{allocations.length} allocation{allocations.length !== 1 ? 's' : ''}</span>
                    <span>{allocations.filter(a => a.status === 'active').length} active</span>
                    <span className="text-amber-400">
                        {Object.values(allocationsByPerson).filter(p => p.totalPct > 100).length} overallocated
                    </span>
                </div>
            </div>

            {/* Allocations List */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-24 bg-slate-800/50 rounded-xl animate-pulse" />
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
                                className={`bg-slate-900 border rounded-xl p-4 transition-all ${
                                    isOverallocated && alloc.status === 'active'
                                        ? 'border-amber-500/30'
                                        : 'border-slate-800 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Person Avatar */}
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-slate-700 flex items-center justify-center flex-shrink-0">
                                        <span className="text-xs font-medium text-teal-400">
                                            {(alloc.person?.full_name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2)}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span
                                                onClick={() => navigate(`/people/${alloc.person_id}`)}
                                                className="text-sm font-medium text-white hover:text-teal-400 cursor-pointer truncate"
                                            >
                                                {alloc.person?.full_name || 'Unknown Person'}
                                            </span>
                                            <ArrowRight size={12} className="text-slate-600" />
                                            <span className="text-sm text-slate-300 truncate">
                                                {alloc.entity_name || alloc.entity_id}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={11} />
                                                {alloc.start_date} to {alloc.end_date}
                                            </span>
                                            <span className="text-slate-600">{alloc.entity_type}</span>
                                            {alloc.notes && <span className="truncate max-w-[200px]">{alloc.notes}</span>}
                                        </div>
                                    </div>

                                    {/* Allocation Value */}
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-lg font-bold text-white">
                                            {alloc.allocation_value}
                                            <span className="text-sm text-slate-400 ml-0.5">
                                                {alloc.allocation_type === 'percentage' ? '%' : `h/${alloc.allocation_period}`}
                                            </span>
                                        </div>
                                        {isOverallocated && alloc.status === 'active' && (
                                            <div className="text-xs text-amber-400">
                                                Total: {personData.totalPct}% allocated
                                            </div>
                                        )}
                                    </div>

                                    {/* Status */}
                                    <StatusBadge status={alloc.status} />

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {alloc.status !== 'cancelled' && alloc.status !== 'completed' && (
                                            <>
                                                <button
                                                    onClick={() => setEditingAllocation(alloc)}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleCancel(alloc.id)}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                                                    title="Cancel"
                                                >
                                                    <XCircle size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Allocation Bar */}
                                {alloc.allocation_type === 'percentage' && alloc.status === 'active' && (
                                    <div className="mt-3 pt-3 border-t border-slate-800/50">
                                        <div className="w-full bg-slate-800 rounded-full h-1.5">
                                            <div
                                                className={`h-1.5 rounded-full transition-all ${
                                                    alloc.allocation_value > 80 ? 'bg-amber-500' : 'bg-teal-500'
                                                }`}
                                                style={{ width: `${Math.min(alloc.allocation_value, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
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

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

// =============================================================================
// Create Allocation Modal
// =============================================================================

interface CreateAllocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateAllocationPayload) => void;
}

const CreateAllocationModal: React.FC<CreateAllocationModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [people, setPeople] = useState<Person[]>([]);
    const [loadingPeople, setLoadingPeople] = useState(false);
    const [formData, setFormData] = useState<CreateAllocationPayload>({
        person_id: '',
        entity_type: 'project',
        entity_id: '',
        entity_name: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        allocation_type: 'percentage',
        allocation_value: 50,
        allocation_period: 'daily',
        notes: '',
    });

    useEffect(() => {
        if (isOpen) {
            setLoadingPeople(true);
            peopleApi.getAll({ status: 'active', limit: 100 })
                .then(result => setPeople(result.data))
                .catch(console.error)
                .finally(() => setLoadingPeople(false));
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.person_id || !formData.entity_id || !formData.start_date || !formData.end_date) return;
        onCreate(formData);
        setFormData({
            person_id: '', entity_type: 'project', entity_id: '', entity_name: '',
            start_date: new Date().toISOString().split('T')[0], end_date: '',
            allocation_type: 'percentage', allocation_value: 50, allocation_period: 'daily', notes: '',
        });
    };

    const updateField = (field: string, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Allocation" size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Person Selection */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Resource</h4>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Person *</label>
                        <select
                            required
                            value={formData.person_id}
                            onChange={(e) => updateField('person_id', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        >
                            <option value="">Select a person...</option>
                            {people.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.full_name} - {p.job_title || p.type} (${p.cost_rate}/{p.cost_rate_unit})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Execution Entity */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Execution Entity</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Entity Type *</label>
                            <select
                                value={formData.entity_type}
                                onChange={(e) => updateField('entity_type', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            >
                                <option value="project">Project</option>
                                <option value="task">Task</option>
                                <option value="work_order">Work Order</option>
                                <option value="engagement">Engagement</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Entity ID *</label>
                            <input
                                type="text" required value={formData.entity_id}
                                onChange={(e) => updateField('entity_id', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                                placeholder="proj-001"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Entity Name</label>
                            <input
                                type="text" value={formData.entity_name || ''}
                                onChange={(e) => updateField('entity_name', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                                placeholder="Website Redesign"
                            />
                        </div>
                    </div>
                </div>

                {/* Allocation Window */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Allocation Window</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Start Date *</label>
                            <input
                                type="date" required value={formData.start_date}
                                onChange={(e) => updateField('start_date', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">End Date *</label>
                            <input
                                type="date" required value={formData.end_date}
                                onChange={(e) => updateField('end_date', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Allocation Amount */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Allocation Amount</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Type</label>
                            <select
                                value={formData.allocation_type}
                                onChange={(e) => updateField('allocation_type', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            >
                                <option value="percentage">Percentage (%)</option>
                                <option value="hours">Hours</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">
                                Value * {formData.allocation_type === 'percentage' ? '(0-100%)' : '(hours)'}
                            </label>
                            <input
                                type="number" required min="1"
                                max={formData.allocation_type === 'percentage' ? 100 : 24}
                                step={formData.allocation_type === 'percentage' ? 5 : 0.5}
                                value={formData.allocation_value}
                                onChange={(e) => updateField('allocation_value', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Period</label>
                            <select
                                value={formData.allocation_period}
                                onChange={(e) => updateField('allocation_period', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>
                        </div>
                    </div>

                    {/* Visual Preview */}
                    {formData.allocation_type === 'percentage' && (
                        <div className="mt-3">
                            <div className="w-full bg-slate-800 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all ${
                                        formData.allocation_value > 80 ? 'bg-amber-500' :
                                        formData.allocation_value > 50 ? 'bg-teal-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(formData.allocation_value, 100)}%` }}
                                />
                            </div>
                            <div className="text-xs text-slate-500 mt-1 text-right">{formData.allocation_value}% capacity</div>
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Notes</label>
                    <textarea
                        value={formData.notes || ''}
                        onChange={(e) => updateField('notes', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500 resize-none"
                        placeholder="Additional context for this allocation..."
                    />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">
                        Create Allocation
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
    onSave: (data: Partial<Allocation>) => void;
}

const EditAllocationModal: React.FC<EditAllocationModalProps> = ({ allocation, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        allocation_value: allocation.allocation_value,
        allocation_type: allocation.allocation_type,
        start_date: allocation.start_date,
        end_date: allocation.end_date,
        status: allocation.status as AllocationStatus,
        notes: allocation.notes || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`Edit Allocation - ${allocation.entity_name || allocation.entity_id}`} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="text-xs text-slate-500 mb-4">
                    {allocation.person?.full_name} allocated to {allocation.entity_name || allocation.entity_id}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                        <input
                            type="date" value={formData.start_date}
                            onChange={(e) => setFormData(d => ({ ...d, start_date: e.target.value }))}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">End Date</label>
                        <input
                            type="date" value={formData.end_date}
                            onChange={(e) => setFormData(d => ({ ...d, end_date: e.target.value }))}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Allocation Value</label>
                        <input
                            type="number" min="1" value={formData.allocation_value}
                            onChange={(e) => setFormData(d => ({ ...d, allocation_value: parseFloat(e.target.value) }))}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData(d => ({ ...d, status: e.target.value as AllocationStatus }))}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        >
                            <option value="planned">Planned</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Notes</label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData(d => ({ ...d, notes: e.target.value }))}
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500 resize-none"
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
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

export default AllocationsPage;

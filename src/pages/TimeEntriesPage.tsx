import React, { useEffect, useState, useCallback } from 'react';
import {
    Clock, Plus, Calendar, CheckCircle, XCircle, Send,
    Filter, DollarSign, User, AlertCircle, Trash2,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import { timeEntriesApi, peopleApi, allocationsApi } from '../services/peopleService';
import type { TimeEntry, CreateTimeEntryPayload, Person, Allocation, TimeEntryStatus } from '../types/people';

const TimeEntriesPage: React.FC = () => {
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [dateFilter, setDateFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

    const loadEntries = useCallback(async () => {
        try {
            setLoading(true);
            const params: Record<string, string | number | undefined> = {
                status: statusFilter || undefined,
                limit: 50,
            };

            if (dateFilter) {
                params.from_date = dateFilter;
                params.to_date = dateFilter;
            }

            const result = await timeEntriesApi.getAll(params as Parameters<typeof timeEntriesApi.getAll>[0]);
            setEntries(result.data);
        } catch (error) {
            console.error('Failed to load time entries:', error);
            setToast({ message: 'Failed to load time entries', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [statusFilter, dateFilter]);

    useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    const handleCreate = async (data: CreateTimeEntryPayload) => {
        try {
            await timeEntriesApi.create(data);
            setShowCreateModal(false);
            setToast({ message: 'Time entry logged', type: 'success' });
            loadEntries();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to log time';
            setToast({ message: msg, type: 'error' });
        }
    };

    const handleSubmit = async (id: string) => {
        try {
            await timeEntriesApi.submit(id);
            setToast({ message: 'Time entry submitted for approval', type: 'success' });
            loadEntries();
        } catch (error) {
            setToast({ message: 'Failed to submit entry', type: 'error' });
        }
    };

    const handleApprove = async (id: string) => {
        try {
            await timeEntriesApi.approve(id);
            setToast({ message: 'Time entry approved - cost attributed', type: 'success' });
            loadEntries();
        } catch (error) {
            setToast({ message: 'Failed to approve entry', type: 'error' });
        }
    };

    const handleReject = async (id: string) => {
        try {
            await timeEntriesApi.reject(id, rejectReason || 'No reason provided');
            setShowRejectModal(null);
            setRejectReason('');
            setToast({ message: 'Time entry rejected', type: 'info' });
            loadEntries();
        } catch (error) {
            setToast({ message: 'Failed to reject entry', type: 'error' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this draft time entry?')) return;
        try {
            await timeEntriesApi.delete(id);
            setToast({ message: 'Time entry deleted', type: 'success' });
            loadEntries();
        } catch (error) {
            setToast({ message: 'Failed to delete entry', type: 'error' });
        }
    };

    const handleBulkApprove = async () => {
        const submittedIds = [...selectedEntries].filter(id => {
            const entry = entries.find(e => e.id === id);
            return entry?.status === 'submitted';
        });

        if (submittedIds.length === 0) {
            setToast({ message: 'No submitted entries selected', type: 'info' });
            return;
        }

        try {
            await Promise.all(submittedIds.map(id => timeEntriesApi.approve(id)));
            setToast({ message: `${submittedIds.length} entries approved`, type: 'success' });
            setSelectedEntries(new Set());
            loadEntries();
        } catch (error) {
            setToast({ message: 'Some approvals failed', type: 'error' });
            loadEntries();
        }
    };

    const toggleEntry = (id: string) => {
        setSelectedEntries(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedEntries.size === entries.length) {
            setSelectedEntries(new Set());
        } else {
            setSelectedEntries(new Set(entries.map(e => e.id)));
        }
    };

    // Summary calculations
    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
    const totalCost = entries.reduce((sum, e) => sum + (e.total_cost || 0), 0);
    const pendingCount = entries.filter(e => e.status === 'submitted').length;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Time Entries"
                subtitle="Controlled time capture linked to execution entities"
                actions={
                    <div className="flex items-center gap-2">
                        {selectedEntries.size > 0 && (
                            <button
                                onClick={handleBulkApprove}
                                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                <CheckCircle size={14} />
                                Approve ({selectedEntries.size})
                            </button>
                        )}
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            <Plus size={16} />
                            Log Time
                        </button>
                    </div>
                }
            />

            {/* Filters & Summary */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="submitted">Submitted</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
                <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                />
                {dateFilter && (
                    <button
                        onClick={() => setDateFilter('')}
                        className="text-xs text-slate-400 hover:text-white"
                    >
                        Clear date
                    </button>
                )}

                {/* Summary */}
                <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {totalHours.toFixed(1)}h total
                    </span>
                    <span className="flex items-center gap-1">
                        <DollarSign size={12} />
                        {formatCurrency(totalCost)}
                    </span>
                    {pendingCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                            <AlertCircle size={12} />
                            {pendingCount} pending
                        </span>
                    )}
                </div>
            </div>

            {/* Entries Table */}
            {loading ? (
                <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : entries.length === 0 ? (
                <EmptyState
                    icon={Clock}
                    title="No time entries"
                    description="Log time against execution entities to track effort and attribute costs."
                    action={{ label: 'Log Time', onClick: () => setShowCreateModal(true) }}
                />
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-[40px_1fr_1fr_100px_100px_100px_120px] gap-4 px-5 py-3 bg-slate-800/50 text-xs font-medium text-slate-400 uppercase tracking-wider">
                        <div>
                            <input
                                type="checkbox"
                                checked={selectedEntries.size === entries.length && entries.length > 0}
                                onChange={toggleAll}
                                className="rounded border-slate-600"
                            />
                        </div>
                        <div>Person / Entity</div>
                        <div>Description</div>
                        <div className="text-right">Date</div>
                        <div className="text-right">Hours</div>
                        <div className="text-right">Cost</div>
                        <div className="text-center">Actions</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-slate-800">
                        {entries.map((entry) => (
                            <div
                                key={entry.id}
                                className={`grid grid-cols-[40px_1fr_1fr_100px_100px_100px_120px] gap-4 px-5 py-3 items-center hover:bg-slate-800/30 transition-colors ${
                                    selectedEntries.has(entry.id) ? 'bg-teal-500/5' : ''
                                }`}
                            >
                                <div>
                                    <input
                                        type="checkbox"
                                        checked={selectedEntries.has(entry.id)}
                                        onChange={() => toggleEntry(entry.id)}
                                        className="rounded border-slate-600"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm text-white truncate">
                                        {entry.person?.full_name || 'Unknown'}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                                        <span className="text-slate-600">{entry.entity_type}</span>
                                        <span>{entry.entity_name || entry.entity_id}</span>
                                    </div>
                                </div>
                                <div className="text-sm text-slate-400 truncate">
                                    {entry.description || '-'}
                                </div>
                                <div className="text-right text-sm text-slate-300">
                                    {entry.work_date}
                                </div>
                                <div className="text-right text-sm font-medium text-white">
                                    {entry.hours}h
                                </div>
                                <div className="text-right text-sm text-slate-300">
                                    {formatCurrency(entry.total_cost || 0)}
                                </div>
                                <div className="flex items-center justify-center gap-1">
                                    <StatusBadge status={entry.status} />
                                    {entry.status === 'draft' && (
                                        <>
                                            <button
                                                onClick={() => handleSubmit(entry.id)}
                                                className="p-1 rounded text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                title="Submit for approval"
                                            >
                                                <Send size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(entry.id)}
                                                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </>
                                    )}
                                    {entry.status === 'submitted' && (
                                        <>
                                            <button
                                                onClick={() => handleApprove(entry.id)}
                                                className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                                title="Approve"
                                            >
                                                <CheckCircle size={13} />
                                            </button>
                                            <button
                                                onClick={() => setShowRejectModal(entry.id)}
                                                className="p-1 rounded text-rose-400 hover:bg-rose-500/10 transition-colors"
                                                title="Reject"
                                            >
                                                <XCircle size={13} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Modal */}
            <CreateTimeEntryModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreate}
            />

            {/* Reject Modal */}
            {showRejectModal && (
                <Modal isOpen={true} onClose={() => { setShowRejectModal(null); setRejectReason(''); }} title="Reject Time Entry" size="sm">
                    <div className="space-y-4">
                        <p className="text-sm text-slate-400">Please provide a reason for rejecting this time entry.</p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={3}
                            placeholder="Reason for rejection..."
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500 resize-none"
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setShowRejectModal(null); setRejectReason(''); }}
                                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleReject(showRejectModal)}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Reject Entry
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

// =============================================================================
// Create Time Entry Modal
// =============================================================================

interface CreateTimeEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateTimeEntryPayload) => void;
}

const CreateTimeEntryModal: React.FC<CreateTimeEntryModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [people, setPeople] = useState<Person[]>([]);
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [loadingPeople, setLoadingPeople] = useState(false);
    const [formData, setFormData] = useState<CreateTimeEntryPayload>({
        person_id: '',
        allocation_id: '',
        entity_type: 'project',
        entity_id: '',
        entity_name: '',
        work_date: new Date().toISOString().split('T')[0],
        hours: 1,
        description: '',
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

    // Load allocations when person is selected
    useEffect(() => {
        if (formData.person_id) {
            allocationsApi.getAll({ person_id: formData.person_id, status: 'active' })
                .then(result => setAllocations(result.data))
                .catch(console.error);
        } else {
            setAllocations([]);
        }
    }, [formData.person_id]);

    const handleAllocationSelect = (allocId: string) => {
        const alloc = allocations.find(a => a.id === allocId);
        if (alloc) {
            setFormData(prev => ({
                ...prev,
                allocation_id: allocId,
                entity_type: alloc.entity_type,
                entity_id: alloc.entity_id,
                entity_name: alloc.entity_name || '',
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                allocation_id: '',
            }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.person_id || !formData.entity_type || !formData.entity_id || !formData.work_date || !formData.hours) return;
        onCreate(formData);
        setFormData({
            person_id: '', allocation_id: '', entity_type: 'project', entity_id: '',
            entity_name: '', work_date: new Date().toISOString().split('T')[0], hours: 1, description: '',
        });
    };

    const updateField = (field: string, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const selectedPerson = people.find(p => p.id === formData.person_id);
    const estimatedCost = selectedPerson ? formData.hours * selectedPerson.cost_rate : 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Log Time" size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Person Selection */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Who</h4>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Person *</label>
                        <select
                            required
                            value={formData.person_id}
                            onChange={(e) => updateField('person_id', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        >
                            <option value="">Select person...</option>
                            {people.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.full_name} - ${p.cost_rate}/{p.cost_rate_unit}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Allocation shortcut */}
                    {allocations.length > 0 && (
                        <div className="mt-3">
                            <label className="block text-xs text-slate-400 mb-1">Link to Allocation (optional)</label>
                            <select
                                value={formData.allocation_id || ''}
                                onChange={(e) => handleAllocationSelect(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            >
                                <option value="">Manual entry (no allocation)</option>
                                {allocations.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.entity_name || a.entity_id} ({a.allocation_value}{a.allocation_type === 'percentage' ? '%' : 'h'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Execution Entity */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">What</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Entity Type *</label>
                            <select
                                value={formData.entity_type}
                                onChange={(e) => updateField('entity_type', e.target.value)}
                                disabled={!!formData.allocation_id}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500 disabled:opacity-50"
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
                                disabled={!!formData.allocation_id}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500 disabled:opacity-50"
                                placeholder="proj-001"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Entity Name</label>
                            <input
                                type="text" value={formData.entity_name || ''}
                                onChange={(e) => updateField('entity_name', e.target.value)}
                                disabled={!!formData.allocation_id}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500 disabled:opacity-50"
                                placeholder="Website Redesign"
                            />
                        </div>
                    </div>
                </div>

                {/* Time Details */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">When & How Much</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Work Date *</label>
                            <input
                                type="date" required value={formData.work_date}
                                onChange={(e) => updateField('work_date', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Hours *</label>
                            <input
                                type="number" required min="0.25" max="24" step="0.25"
                                value={formData.hours}
                                onChange={(e) => updateField('hours', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Description</label>
                    <textarea
                        value={formData.description || ''}
                        onChange={(e) => updateField('description', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500 resize-none"
                        placeholder="Brief description of work performed..."
                    />
                </div>

                {/* Cost Preview */}
                {selectedPerson && formData.hours > 0 && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">Estimated Cost</span>
                            <span className="font-medium text-white">
                                {formData.hours}h x ${selectedPerson.cost_rate}/{selectedPerson.cost_rate_unit} = ${estimatedCost.toFixed(2)}
                            </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            Cost is captured at the person's current rate and becomes immutable upon entry.
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">
                        Log Time
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default TimeEntriesPage;

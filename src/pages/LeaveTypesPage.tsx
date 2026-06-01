import React, { useEffect, useState, useCallback } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { leaveTypesApi, LeaveType, CreateLeaveTypePayload } from '../services/leaveTypesService';

const LeaveTypesPage: React.FC = () => {
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreate = (shell?.effectiveFlagsLoaded ?? false) && (shell?.isFeatureEnabled?.('action:people:leave_types:create') ?? true);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const loadLeaveTypes = useCallback(async () => {
        try {
            setLoading(true);
            const result = await leaveTypesApi.getAll();
            setLeaveTypes(result.data);
        } catch (error) {
            console.error('Failed to load leave types:', error);
            setToast({ message: 'Failed to load leave types', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLeaveTypes();
    }, [loadLeaveTypes]);

    const handleCreate = async (data: CreateLeaveTypePayload) => {
        try {
            const created = await leaveTypesApi.create(data);
            setShowCreateModal(false);
            setToast({ message: `Leave type ${data.name} has been created`, type: 'success' });
            recordActivity({ eventType: 'people.leave_type.created', eventCategory: 'data', description: `Leave type ${data.name} was created`, resourceType: 'leave_type', resourceId: created?.id }).catch(() => {});
            loadLeaveTypes();
        } catch (error) {
            setToast({ message: 'Failed to create leave type', type: 'error' });
        }
    };

    const handleUpdate = async (id: string, data: Partial<LeaveType>) => {
        try {
            await leaveTypesApi.update(id, data);
            setEditingLeaveType(null);
            setToast({ message: 'Leave type updated successfully', type: 'success' });
            recordActivity({ eventType: 'people.leave_type.updated', eventCategory: 'data', description: `Leave type ${data.name || id} was updated`, resourceType: 'leave_type', resourceId: id }).catch(() => {});
            loadLeaveTypes();
        } catch (error) {
            setToast({ message: 'Failed to update leave type', type: 'error' });
        }
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Leave Types"
                subtitle="Configure leave policies and accrual rules"
                actions={
                    canCreate && <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <CalendarClock size={16} />
                        Create Leave Type
                    </button>
                }
            />

            {/* Leave Types Table */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : leaveTypes.length === 0 ? (
                <EmptyState
                    icon={CalendarClock}
                    title="No leave types found"
                    description="Create leave types to manage employee time off."
                    action={{ label: 'Create Leave Type', onClick: () => setShowCreateModal(true) }}
                />
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Code</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Paid</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Approval</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Accrual</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Max Days/Year</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Carry Forward</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {leaveTypes.map(leaveType => (
                                <tr
                                    key={leaveType.id}
                                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                                    onClick={() => setEditingLeaveType(leaveType)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {leaveType.color && (
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: leaveType.color }}
                                                />
                                            )}
                                            <span className="text-sm font-medium text-slate-50">{leaveType.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400">{leaveType.code}</td>
                                    <td className="px-4 py-3 text-center">
                                        <StatusBadge status={leaveType.is_paid ? 'paid' : 'unpaid'} />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <StatusBadge status={leaveType.requires_approval ? 'required' : 'not_required'} />
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400 capitalize">{leaveType.accrual_type}</td>
                                    <td className="px-4 py-3 text-center text-sm text-slate-400">
                                        {leaveType.max_days_per_year || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <StatusBadge status={leaveType.carry_forward_allowed ? 'allowed' : 'not_allowed'} />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <StatusBadge status={leaveType.is_active ? 'active' : 'inactive'} />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {canCreate && <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingLeaveType(leaveType);
                                            }}
                                            className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                                        >
                                            Edit
                                        </button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create/Edit Modal */}
            <LeaveTypeModal
                isOpen={showCreateModal || !!editingLeaveType}
                onClose={() => {
                    setShowCreateModal(false);
                    setEditingLeaveType(null);
                }}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
                leaveType={editingLeaveType}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

// =============================================================================
// Leave Type Modal
// =============================================================================

interface LeaveTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateLeaveTypePayload) => void;
    onUpdate: (id: string, data: Partial<LeaveType>) => void;
    leaveType: LeaveType | null;
}

const LeaveTypeModal: React.FC<LeaveTypeModalProps> = ({ isOpen, onClose, onCreate, onUpdate, leaveType }) => {
    const [formData, setFormData] = useState<CreateLeaveTypePayload>({
        code: '',
        name: '',
        description: '',
        is_paid: true,
        requires_approval: true,
        requires_documentation: false,
        accrual_type: 'annual',
        max_days_per_year: 20,
        accrual_rate: 1.67,
        carry_forward_allowed: false,
        max_carry_forward_days: 0,
        notice_period_days: 0,
        color: '#10b981',
        is_active: true,
    });

    useEffect(() => {
        if (leaveType) {
            setFormData({
                code: leaveType.code,
                name: leaveType.name,
                description: leaveType.description || '',
                is_paid: leaveType.is_paid,
                requires_approval: leaveType.requires_approval,
                requires_documentation: leaveType.requires_documentation,
                accrual_type: leaveType.accrual_type,
                max_days_per_year: leaveType.max_days_per_year,
                accrual_rate: leaveType.accrual_rate,
                carry_forward_allowed: leaveType.carry_forward_allowed,
                max_carry_forward_days: leaveType.max_carry_forward_days,
                notice_period_days: leaveType.notice_period_days,
                color: leaveType.color,
                is_active: leaveType.is_active,
            });
        }
    }, [leaveType]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code || !formData.name) return;

        if (leaveType) {
            onUpdate(leaveType.id, formData);
        } else {
            onCreate(formData);
        }
    };

    const updateField = (field: keyof CreateLeaveTypePayload, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={leaveType ? 'Edit Leave Type' : 'Create Leave Type'} size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Basic Info */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Basic Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Code *</label>
                            <input
                                type="text"
                                required
                                value={formData.code}
                                onChange={(e) => updateField('code', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                                placeholder="AL"
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
                                placeholder="Annual Leave"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs text-slate-400 mb-1">Description</label>
                            <textarea
                                value={formData.description || ''}
                                onChange={(e) => updateField('description', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                                rows={2}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Color</label>
                            <input
                                type="color"
                                value={formData.color || '#10b981'}
                                onChange={(e) => updateField('color', e.target.value)}
                                className="w-full h-10 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Policies */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Policies</h4>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.is_paid}
                                onChange={(e) => updateField('is_paid', e.target.checked)}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-sm text-slate-300">Paid Leave</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.requires_approval}
                                onChange={(e) => updateField('requires_approval', e.target.checked)}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-sm text-slate-300">Requires Approval</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.requires_documentation}
                                onChange={(e) => updateField('requires_documentation', e.target.checked)}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-sm text-slate-300">Requires Documentation</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.carry_forward_allowed}
                                onChange={(e) => updateField('carry_forward_allowed', e.target.checked)}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-sm text-slate-300">Allow Carry Forward</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.is_active}
                                onChange={(e) => updateField('is_active', e.target.checked)}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-sm text-slate-300">Active</span>
                        </label>
                    </div>
                </div>

                {/* Accrual & Limits */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Accrual & Limits</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Accrual Type</label>
                            <select
                                value={formData.accrual_type}
                                onChange={(e) => updateField('accrual_type', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                <option value="annual">Annual</option>
                                <option value="monthly">Monthly</option>
                                <option value="none">None</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Max Days Per Year</label>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={formData.max_days_per_year || ''}
                                onChange={(e) => updateField('max_days_per_year', parseFloat(e.target.value) || undefined)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Accrual Rate (days/month)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.accrual_rate || ''}
                                onChange={(e) => updateField('accrual_rate', parseFloat(e.target.value) || undefined)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Max Carry Forward Days</label>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={formData.max_carry_forward_days || ''}
                                onChange={(e) => updateField('max_carry_forward_days', parseFloat(e.target.value) || undefined)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Notice Period (days)</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.notice_period_days || ''}
                                onChange={(e) => updateField('notice_period_days', parseInt(e.target.value) || undefined)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                    </div>
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
                        {leaveType ? 'Update' : 'Create'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default LeaveTypesPage;

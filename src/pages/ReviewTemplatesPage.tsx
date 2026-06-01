import React, { useEffect, useState, useCallback } from 'react';
import { FileText, Copy } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { reviewTemplatesApi, ReviewTemplate, CreateReviewTemplatePayload } from '../services/reviewTemplatesService';

const ReviewTemplatesPage: React.FC = () => {
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreate = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:review_templates:create') ?? true);
    const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ReviewTemplate | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const loadTemplates = useCallback(async () => {
        try {
            setLoading(true);
            const result = await reviewTemplatesApi.getAll();
            setTemplates(result.data);
        } catch (error) {
            console.error('Failed to load review templates:', error);
            setToast({ message: 'Failed to load review templates', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    const handleCreate = async (data: CreateReviewTemplatePayload) => {
        try {
            const created = await reviewTemplatesApi.create(data);
            setShowCreateModal(false);
            setToast({ message: `Review template ${data.name} has been created`, type: 'success' });
            recordActivity({ eventType: 'people.review_template.created', eventCategory: 'data', description: `Review template ${data.name} was created`, resourceType: 'review_template', resourceId: created?.id }).catch(() => {});
            loadTemplates();
        } catch (error) {
            setToast({ message: 'Failed to create review template', type: 'error' });
        }
    };

    const handleUpdate = async (id: string, data: Partial<ReviewTemplate>) => {
        try {
            await reviewTemplatesApi.update(id, data);
            setEditingTemplate(null);
            setToast({ message: 'Review template updated successfully', type: 'success' });
            recordActivity({ eventType: 'people.review_template.updated', eventCategory: 'data', description: `Review template ${data.name || id} was updated`, resourceType: 'review_template', resourceId: id }).catch(() => {});
            loadTemplates();
        } catch (error) {
            setToast({ message: 'Failed to update review template', type: 'error' });
        }
    };

    const handleClone = async (template: ReviewTemplate) => {
        const newName = prompt(`Clone template as:`, `${template.name} (Copy)`);
        if (!newName) return;

        try {
            await reviewTemplatesApi.clone(template.id, newName);
            setToast({ message: 'Template cloned successfully', type: 'success' });
            loadTemplates();
        } catch (error) {
            setToast({ message: 'Failed to clone template', type: 'error' });
        }
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Review Templates"
                subtitle="Configure performance review structures"
                actions={
                    canCreate && <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <FileText size={16} />
                        Create Template
                    </button>
                }
            />

            {/* Templates Table */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : templates.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title="No review templates found"
                    description="Create templates to standardize performance reviews."
                    action={canCreate ? { label: 'Create Template', onClick: () => setShowCreateModal(true) } : undefined}
                />
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Review Type</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Rating Scale</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Self Review</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Manager Review</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {templates.map(template => (
                                <tr
                                    key={template.id}
                                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                                    onClick={() => setEditingTemplate(template)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="text-sm font-medium text-slate-50">{template.name}</div>
                                        {template.description && (
                                            <div className="text-xs text-slate-500">{template.description}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400 capitalize">
                                        {template.review_type.replace('_', ' ')}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-slate-400">
                                        {template.rating_scale}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <StatusBadge status={template.requires_self_review ? 'required' : 'not_required'} />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <StatusBadge status={template.requires_manager_review ? 'required' : 'not_required'} />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <StatusBadge status={template.is_active ? 'active' : 'inactive'} />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {canCreate && <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleClone(template);
                                                }}
                                                className="text-xs text-slate-400 hover:text-teal-400 transition-colors"
                                                title="Clone template"
                                            >
                                                <Copy size={14} />
                                            </button>}
                                            {canCreate && <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingTemplate(template);
                                                }}
                                                className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                                            >
                                                Edit
                                            </button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create/Edit Modal */}
            <ReviewTemplateModal
                isOpen={showCreateModal || !!editingTemplate}
                onClose={() => {
                    setShowCreateModal(false);
                    setEditingTemplate(null);
                }}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
                template={editingTemplate}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

// =============================================================================
// Review Template Modal (Simplified)
// =============================================================================

interface ReviewTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateReviewTemplatePayload) => void;
    onUpdate: (id: string, data: Partial<ReviewTemplate>) => void;
    template: ReviewTemplate | null;
}

const ReviewTemplateModal: React.FC<ReviewTemplateModalProps> = ({
    isOpen,
    onClose,
    onCreate,
    onUpdate,
    template,
}) => {
    const [formData, setFormData] = useState<CreateReviewTemplatePayload>({
        name: '',
        description: '',
        review_type: 'annual',
        rating_scale: 5,
        rating_labels: { '1': 'Poor', '2': 'Fair', '3': 'Good', '4': 'Very Good', '5': 'Excellent' },
        sections: [],
        requires_self_review: true,
        requires_manager_review: true,
        is_active: true,
    });

    useEffect(() => {
        if (template) {
            setFormData({
                name: template.name,
                description: template.description || '',
                review_type: template.review_type,
                rating_scale: template.rating_scale,
                rating_labels: template.rating_labels,
                sections: template.sections,
                requires_self_review: template.requires_self_review,
                requires_manager_review: template.requires_manager_review,
                is_active: template.is_active,
            });
        }
    }, [template]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        if (template) {
            onUpdate(template.id, formData);
        } else {
            onCreate(formData);
        }
    };

    const updateField = (field: keyof CreateReviewTemplatePayload, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={template ? 'Edit Review Template' : 'Create Review Template'}
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs text-slate-400 mb-1">Name *</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => updateField('name', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            placeholder="Annual Performance Review"
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
                        <label className="block text-xs text-slate-400 mb-1">Review Type</label>
                        <select
                            value={formData.review_type}
                            onChange={(e) => updateField('review_type', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        >
                            <option value="annual">Annual</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="probation">Probation</option>
                            <option value="project_end">Project End</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Rating Scale</label>
                        <select
                            value={formData.rating_scale}
                            onChange={(e) => updateField('rating_scale', parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        >
                            <option value="3">3 Point</option>
                            <option value="5">5 Point</option>
                            <option value="10">10 Point</option>
                            <option value="100">100 Point</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={formData.requires_self_review}
                            onChange={(e) => updateField('requires_self_review', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-sm text-slate-300">Requires Self Review</span>
                    </label>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={formData.requires_manager_review}
                            onChange={(e) => updateField('requires_manager_review', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-sm text-slate-300">Requires Manager Review</span>
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

                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <p className="text-xs text-slate-400">
                        Note: Section builder and rating labels editor will be implemented in a future iteration.
                        Templates created now will have default sections.
                    </p>
                </div>

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
                        {template ? 'Update' : 'Create'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ReviewTemplatesPage;

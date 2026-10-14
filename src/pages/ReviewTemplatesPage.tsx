import React, { useEffect, useState, useCallback } from 'react';
import { FileText, Copy } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { toast, Select } from '@so360/design-system';
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

    const loadTemplates = useCallback(async () => {
        try {
            setLoading(true);
            const result = await reviewTemplatesApi.getAll();
            setTemplates(result.data);
        } catch (error) {
            console.error('Failed to load review templates:', error);
            toast.error('Failed to load review templates');
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
            toast.success(`Review template ${data.name} has been created`);
            recordActivity({ eventType: 'people.review_template.created', eventCategory: 'data', description: `Review template ${data.name} was created`, resourceType: 'review_template', resourceId: created?.id }).catch(() => {});
            loadTemplates();
        } catch (error) {
            toast.error('Failed to create review template');
        }
    };

    const handleUpdate = async (id: string, data: Partial<ReviewTemplate>) => {
        try {
            await reviewTemplatesApi.update(id, data);
            setEditingTemplate(null);
            toast.success('Review template updated successfully');
            recordActivity({ eventType: 'people.review_template.updated', eventCategory: 'data', description: `Review template ${data.name || id} was updated`, resourceType: 'review_template', resourceId: id }).catch(() => {});
            loadTemplates();
        } catch (error) {
            toast.error('Failed to update review template');
        }
    };

    const handleClone = async (template: ReviewTemplate) => {
        const newName = prompt(`Clone template as:`, `${template.name} (Copy)`);
        if (!newName) return;

        try {
            await reviewTemplatesApi.clone(template.id, newName);
            toast.success('Template cloned successfully');
            loadTemplates();
        } catch (error) {
            toast.error('Failed to clone template');
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
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors"
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
                        <div key={i} className="h-16 bg-surface-raised/50 rounded-nb animate-pulse" />
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
                <div className="bg-surface border border-line rounded-nb overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-surface-raised/50 border-b border-line">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Review Type</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Rating Scale</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Self Review</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Manager Review</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {templates.map(template => (
                                <tr
                                    key={template.id}
                                    className="hover:bg-surface-raised/50 cursor-pointer transition-colors"
                                    onClick={() => setEditingTemplate(template)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="text-sm font-medium text-fg">{template.name}</div>
                                        {template.description && (
                                            <div className="text-xs text-fg-subtle">{template.description}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-fg-muted capitalize">
                                        {template.review_type.replace('_', ' ')}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-fg-muted">
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
                                                className="text-xs text-fg-muted hover:text-primary transition-colors"
                                                title="Clone template"
                                            >
                                                <Copy size={14} />
                                            </button>}
                                            {canCreate && <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingTemplate(template);
                                                }}
                                                className="text-xs text-primary hover:text-primary transition-colors"
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
                        <label className="block text-xs text-fg-muted mb-1">Name *</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => updateField('name', e.target.value)}
                            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                            placeholder="Annual Performance Review"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs text-fg-muted mb-1">Description</label>
                        <textarea
                            value={formData.description || ''}
                            onChange={(e) => updateField('description', e.target.value)}
                            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                            rows={2}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Review Type</label>
                        <Select name="reviewtemplates-select-82" value={formData.review_type} onChange={(e) => updateField('review_type', e.target.value)} options={[{ value: "annual", label: "Annual" }, { value: "quarterly", label: "Quarterly" }, { value: "probation", label: "Probation" }, { value: "project_end", label: "Project End" }, { value: "custom", label: "Custom" }]} />
                    </div>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Rating Scale</label>
                        <Select name="reviewtemplates-select-83" value={formData.rating_scale} onChange={(e) => updateField('rating_scale', parseInt(e.target.value))} options={[{ value: "3", label: "3 Point" }, { value: "5", label: "5 Point" }, { value: "10", label: "10 Point" }, { value: "100", label: "100 Point" }]} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={formData.requires_self_review}
                            onChange={(e) => updateField('requires_self_review', e.target.checked)}
                            className="w-4 h-4 rounded border-line-strong bg-surface-raised text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-fg">Requires Self Review</span>
                    </label>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={formData.requires_manager_review}
                            onChange={(e) => updateField('requires_manager_review', e.target.checked)}
                            className="w-4 h-4 rounded border-line-strong bg-surface-raised text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-fg">Requires Manager Review</span>
                    </label>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={formData.is_active}
                            onChange={(e) => updateField('is_active', e.target.checked)}
                            className="w-4 h-4 rounded border-line-strong bg-surface-raised text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-fg">Active</span>
                    </label>
                </div>

                <div className="bg-surface-raised/50 border border-line-strong rounded-nb p-4">
                    <p className="text-xs text-fg-muted">
                        Note: Section builder and rating labels editor will be implemented in a future iteration.
                        Templates created now will have default sections.
                    </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors"
                    >
                        {template ? 'Update' : 'Create'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ReviewTemplatesPage;

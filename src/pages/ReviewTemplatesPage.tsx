import React, { useEffect, useState, useCallback } from 'react';
import { FileText } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import {
    toast, Select, ListPageTemplate, DataTable, Modal, Button, Cluster, Stack, Grid,
    TextField, Textarea, Checkbox, Alert,
} from '@so360/design-system';
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
        <ListPageTemplate trail={[]}
            title="Review Templates"
            description="Configure performance review structures"
            loading={loading}
            isEmpty={templates.length === 0}
            primaryAction={canCreate ? (
                <Button type="button" onClick={() => setShowCreateModal(true)}>
                    <FileText className="w-4 h-4" /> Create Template
                </Button>
            ) : undefined}
            empty={(
                <EmptyState
                    icon={FileText}
                    title="No review templates found"
                    description="Create templates to standardize performance reviews."
                    action={canCreate ? { label: 'Create Template', onClick: () => setShowCreateModal(true) } : undefined}
                />
            )}
        >
            <DataTable<ReviewTemplate>
                name="review-templates"
                rows={templates}
                rowKey={(t) => t.id}
                onRowClick={(t) => setEditingTemplate(t)}
                columns={[
                    {
                        key: 'name',
                        header: 'Name',
                        render: (t) => (
                            <Stack gap="tight">
                                <span className="text-nb-sm font-medium text-fg">{t.name}</span>
                                {t.description && <span className="text-nb-xs text-fg-subtle">{t.description}</span>}
                            </Stack>
                        ),
                    },
                    {
                        key: 'review_type',
                        header: 'Review Type',
                        render: (t) => <span className="text-nb-sm text-fg-muted capitalize">{t.review_type.replace('_', ' ')}</span>,
                    },
                    {
                        key: 'rating_scale',
                        header: 'Rating Scale',
                        align: 'center',
                        render: (t) => <span className="text-nb-sm text-fg-muted">{t.rating_scale}</span>,
                    },
                    {
                        key: 'requires_self_review',
                        header: 'Self Review',
                        align: 'center',
                        render: (t) => <StatusBadge status={t.requires_self_review ? 'required' : 'not_required'} />,
                    },
                    {
                        key: 'requires_manager_review',
                        header: 'Manager Review',
                        align: 'center',
                        render: (t) => <StatusBadge status={t.requires_manager_review ? 'required' : 'not_required'} />,
                    },
                    {
                        key: 'is_active',
                        header: 'Status',
                        align: 'center',
                        render: (t) => <StatusBadge status={t.is_active ? 'active' : 'inactive'} />,
                    },
                ]}
                rowActions={canCreate ? (t) => [
                    { label: 'Clone template', onSelect: () => handleClone(t) },
                    { label: 'Edit', onSelect: () => setEditingTemplate(t) },
                ] : undefined}
            />

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
        </ListPageTemplate>
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
            open={isOpen}
            onClose={onClose}
            title={template ? 'Edit Review Template' : 'Create Review Template'}
            size="lg"
            footer={(
                <Cluster gap="default" justify="end">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="review-template-form">{template ? 'Update' : 'Create'}</Button>
                </Cluster>
            )}
        >
            <form id="review-template-form" onSubmit={handleSubmit}>
                <Stack gap="region">
                    <TextField
                        name="name"
                        label="Name *"
                        value={formData.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        placeholder="Annual Performance Review"
                    />
                    <Textarea
                        name="description"
                        label="Description"
                        rows={2}
                        value={formData.description || ''}
                        onChange={(e) => updateField('description', e.target.value)}
                    />
                    <Grid columns={2} gap="lg">
                        <Select
                            name="review_type"
                            label="Review Type"
                            value={formData.review_type}
                            onChange={(e) => updateField('review_type', e.target.value)}
                            options={[{ value: 'annual', label: 'Annual' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'probation', label: 'Probation' }, { value: 'project_end', label: 'Project End' }, { value: 'custom', label: 'Custom' }]}
                        />
                        <Select
                            name="rating_scale"
                            label="Rating Scale"
                            value={String(formData.rating_scale)}
                            onChange={(e) => updateField('rating_scale', parseInt(e.target.value))}
                            options={[{ value: '3', label: '3 Point' }, { value: '5', label: '5 Point' }, { value: '10', label: '10 Point' }, { value: '100', label: '100 Point' }]}
                        />
                    </Grid>

                    <Stack gap="tight">
                        <Checkbox
                            name="requires_self_review"
                            label="Requires Self Review"
                            checked={formData.requires_self_review}
                            onChange={(e) => updateField('requires_self_review', e.target.checked)}
                        />
                        <Checkbox
                            name="requires_manager_review"
                            label="Requires Manager Review"
                            checked={formData.requires_manager_review}
                            onChange={(e) => updateField('requires_manager_review', e.target.checked)}
                        />
                        <Checkbox
                            name="is_active"
                            label="Active"
                            checked={formData.is_active}
                            onChange={(e) => updateField('is_active', e.target.checked)}
                        />
                    </Stack>

                    <Alert variant="info">
                        Note: Section builder and rating labels editor will be implemented in a future iteration.
                        Templates created now will have default sections.
                    </Alert>
                </Stack>
            </form>
        </Modal>
    );
};

export default ReviewTemplatesPage;

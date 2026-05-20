import React, { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Plus, Star, CheckCircle, Eye, EyeOff } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { feedbackApi, Feedback, CreateFeedbackPayload } from '../services/feedbackService';
import { peopleApi } from '../services/peopleService';
import { apiContext } from '../services/apiClient';
import type { Person } from '../types/people';

const FeedbackPage: React.FC = () => {
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreate = (shell?.isFeatureEnabled?.('action:people:feedback:create') ?? true);
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const loadFeedback = useCallback(async () => {
        setLoading(true);
        try {
            const result = await feedbackApi.getAll({
                feedback_type: typeFilter || undefined,
                limit: 50,
            });
            setFeedbacks(result.data || []);
        } catch (error) {
            console.error('Failed to load feedback:', error);
        } finally {
            setLoading(false);
        }
    }, [typeFilter]);

    useEffect(() => {
        loadFeedback();
    }, [loadFeedback]);

    const handleCreate = async (data: CreateFeedbackPayload) => {
        try {
            const created = await feedbackApi.create(data);
            setToast({ message: 'Feedback submitted successfully', type: 'success' });
            setShowCreateModal(false);
            recordActivity({ eventType: 'people.feedback.submitted', eventCategory: 'data', description: `${data.feedback_type} feedback was submitted`, resourceType: 'feedback', resourceId: created?.id }).catch(() => {});
            loadFeedback();
        } catch (error: any) {
            setToast({ message: error.message || 'Failed to submit feedback', type: 'error' });
        }
    };

    const handleAcknowledge = async (id: string) => {
        try {
            await feedbackApi.acknowledge(id);
            setToast({ message: 'Feedback acknowledged', type: 'success' });
            loadFeedback();
        } catch (error: any) {
            setToast({ message: error.message || 'Failed to acknowledge', type: 'error' });
        }
    };

    const feedbackTypeColors: Record<string, string> = {
        positive: 'bg-green-900/40 text-green-400',
        constructive: 'bg-amber-900/40 text-amber-400',
        general: 'bg-blue-900/40 text-blue-400',
        '360_degree': 'bg-purple-900/40 text-purple-400',
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Feedback"
                subtitle="Give and receive feedback across the team"
                actions={
                    canCreate && <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <Plus size={16} /> Give Feedback
                    </button>
                }
            />

            {/* Filters */}
            <div className="flex items-center gap-3">
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Types</option>
                    <option value="positive">Positive</option>
                    <option value="constructive">Constructive</option>
                    <option value="general">General</option>
                    <option value="360_degree">360 Degree</option>
                </select>
            </div>

            {/* Feedback List */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-800/50 rounded-xl animate-pulse" />)}
                </div>
            ) : feedbacks.length === 0 ? (
                <EmptyState
                    icon={MessageSquare}
                    title="No feedback yet"
                    description="Start giving feedback to your team members."
                />
            ) : (
                <div className="space-y-3">
                    {feedbacks.map(fb => (
                        <div key={fb.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs font-medium text-white">
                                        {fb.is_anonymous ? '?' : fb.provider?.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <p className="text-sm text-white font-medium">
                                            {fb.is_anonymous ? 'Anonymous' : fb.provider?.full_name || 'Unknown'}
                                            <span className="text-slate-400 font-normal"> to </span>
                                            {fb.person?.full_name || 'Unknown'}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${feedbackTypeColors[fb.feedback_type] || 'bg-slate-700 text-slate-300'}`}>
                                                {fb.feedback_type.replace('_', ' ')}
                                            </span>
                                            {fb.provider_relationship && (
                                                <span className="text-[10px] text-slate-500 capitalize">{fb.provider_relationship.replace('_', ' ')}</span>
                                            )}
                                            <span className="text-[10px] text-slate-500">
                                                {new Date(fb.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {fb.overall_rating && (
                                        <div className="flex items-center gap-0.5">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <Star key={i} size={12} className={i < fb.overall_rating! ? 'fill-yellow-500 text-yellow-500' : 'text-slate-700'} />
                                            ))}
                                        </div>
                                    )}
                                    {fb.is_visible_to_subject ? (
                                        <span title="Visible to subject"><Eye size={14} className="text-slate-500" /></span>
                                    ) : (
                                        <span title="Hidden from subject"><EyeOff size={14} className="text-slate-500" /></span>
                                    )}
                                </div>
                            </div>

                            <p className="text-sm text-slate-300 mb-2">{fb.feedback_text}</p>

                            {fb.strengths && (
                                <p className="text-xs text-green-400 mb-1">Strengths: {fb.strengths}</p>
                            )}
                            {fb.areas_for_improvement && (
                                <p className="text-xs text-amber-400 mb-1">Areas to improve: {fb.areas_for_improvement}</p>
                            )}

                            {!fb.acknowledged_at && (
                                <div className="mt-3 pt-3 border-t border-slate-800">
                                    <button
                                        onClick={() => handleAcknowledge(fb.id)}
                                        className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300"
                                    >
                                        <CheckCircle size={14} /> Acknowledge
                                    </button>
                                </div>
                            )}
                            {fb.acknowledged_at && (
                                <p className="mt-2 text-[10px] text-slate-500">
                                    Acknowledged on {new Date(fb.acknowledged_at).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create Feedback Modal */}
            <CreateFeedbackModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreate}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

// =============================================================================
// Create Feedback Modal
// =============================================================================

interface CreateFeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateFeedbackPayload) => void;
}

const CreateFeedbackModal: React.FC<CreateFeedbackModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [people, setPeople] = useState<Person[]>([]);
    const [personSearch, setPersonSearch] = useState('');
    const [formData, setFormData] = useState<CreateFeedbackPayload>({
        person_id: '',
        provider_id: apiContext.getUserId() || '',
        feedback_type: 'positive',
        feedback_text: '',
        is_anonymous: false,
        is_visible_to_subject: true,
    });

    useEffect(() => {
        if (isOpen) {
            peopleApi.getAll({ status: 'active', limit: 200 }).then(res => {
                setPeople(res.data || []);
            }).catch(() => {});
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.person_id || !formData.feedback_text) return;
        onCreate(formData);
    };

    const updateField = (field: keyof CreateFeedbackPayload, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const selectedPerson = people.find(p => p.id === formData.person_id);
    const filteredPeople = people.filter(p =>
        !personSearch || p.full_name.toLowerCase().includes(personSearch.toLowerCase())
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Give Feedback">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Person Selector */}
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Feedback For *</label>
                    {selectedPerson ? (
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg">
                            <span className="text-sm text-white">{selectedPerson.full_name}</span>
                            <button type="button" onClick={() => updateField('person_id', '')} className="text-xs text-slate-400 hover:text-red-400">Clear</button>
                        </div>
                    ) : (
                        <div>
                            <input
                                type="text"
                                placeholder="Search people..."
                                value={personSearch}
                                onChange={(e) => setPersonSearch(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            />
                            {personSearch && (
                                <div className="mt-1 max-h-32 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg">
                                    {filteredPeople.slice(0, 10).map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => { updateField('person_id', p.id); setPersonSearch(''); }}
                                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                                        >
                                            {p.full_name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Feedback Type *</label>
                        <select
                            value={formData.feedback_type}
                            onChange={(e) => updateField('feedback_type', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        >
                            <option value="positive">Positive</option>
                            <option value="constructive">Constructive</option>
                            <option value="general">General</option>
                            <option value="360_degree">360 Degree</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Relationship</label>
                        <select
                            value={formData.provider_relationship || ''}
                            onChange={(e) => updateField('provider_relationship', e.target.value || undefined)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        >
                            <option value="">Select...</option>
                            <option value="manager">Manager</option>
                            <option value="peer">Peer</option>
                            <option value="direct_report">Direct Report</option>
                            <option value="cross_functional">Cross-Functional</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Feedback *</label>
                    <textarea
                        required
                        rows={4}
                        value={formData.feedback_text}
                        onChange={(e) => updateField('feedback_text', e.target.value)}
                        placeholder="Share your feedback..."
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Strengths</label>
                    <input
                        type="text"
                        value={formData.strengths || ''}
                        onChange={(e) => updateField('strengths', e.target.value)}
                        placeholder="Highlight strengths..."
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Areas for Improvement</label>
                    <input
                        type="text"
                        value={formData.areas_for_improvement || ''}
                        onChange={(e) => updateField('areas_for_improvement', e.target.value)}
                        placeholder="Suggest improvements..."
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Overall Rating</label>
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(r => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => updateField('overall_rating', r)}
                                className="p-0.5"
                            >
                                <Star
                                    size={20}
                                    className={(formData.overall_rating || 0) >= r ? 'fill-yellow-500 text-yellow-500' : 'text-slate-600 hover:text-slate-400'}
                                />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={formData.is_anonymous}
                            onChange={(e) => updateField('is_anonymous', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600"
                        />
                        <span className="text-sm text-slate-300">Submit anonymously</span>
                    </label>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={formData.is_visible_to_subject !== false}
                            onChange={(e) => updateField('is_visible_to_subject', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600"
                        />
                        <span className="text-sm text-slate-300">Visible to subject</span>
                    </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!formData.person_id || !formData.feedback_text}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Submit Feedback
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default FeedbackPage;

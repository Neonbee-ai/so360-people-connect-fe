import React, { useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, CheckCircle, Upload } from 'lucide-react';
import { toast, getErrorMessage } from '@so360/design-system';
import { myOnboardingApi, type MyOnboardingResponse, type OnboardingInstanceItem } from '../../services/onboardingService';
import { MyCard, ProgressBar, StatusPill } from './myUi';

/**
 * "Your onboarding" — shown on My Work only while the employee has an active
 * onboarding instance. Employee-assigned task/meeting steps are completable
 * inline; document_upload steps complete by attaching the requested document
 * (B4 — the /me upload-document route); e_sign steps surface as "waiting"
 * until the Sign flow (B3) settles them. The backend 400s a direct
 * self-complete on both types by design.
 *
 * Renders nothing (never an error) when there is no instance, the flag is off,
 * or the endpoint is unreachable — this card must not degrade the landing page.
 */
const MyOnboardingCard: React.FC = () => {
    const [data, setData] = useState<MyOnboardingResponse | null>(null);
    const [completingId, setCompletingId] = useState<string | null>(null);
    // B4 — inline attach form state for MY document_upload steps.
    const [attachingId, setAttachingId] = useState<string | null>(null);
    const [fileName, setFileName] = useState('');
    const [fileUrl, setFileUrl] = useState('');
    const [uploading, setUploading] = useState(false);

    const load = useCallback(async () => {
        try {
            setData(await myOnboardingApi.get());
        } catch {
            setData(null);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    if (!data?.instance || data.instance.status !== 'in_progress') return null;

    const items = [...data.items].sort((a, b) => a.sort_order - b.sort_order);
    const settled = items.filter(i => i.status !== 'pending').length;
    const percent = items.length === 0 ? 0 : Math.round((settled / items.length) * 100);
    const pending = items.filter(i => i.status === 'pending');

    const selfCompletable = (item: OnboardingInstanceItem) =>
        item.assignee_role === 'employee' &&
        (item.item_type === 'task' || item.item_type === 'meeting');

    const toggleAttach = (item: OnboardingInstanceItem) => {
        setAttachingId(prev => (prev === item.id ? null : item.id));
        setFileName('');
        setFileUrl('');
    };

    const handleAttach = async (item: OnboardingInstanceItem) => {
        if (!fileName.trim()) return;
        setUploading(true);
        try {
            const result = await myOnboardingApi.uploadItemDocument(item.id, {
                file_name: fileName.trim(),
                ...(fileUrl.trim() ? { file_url: fileUrl.trim() } : {}),
            });
            toast.success(
                result.instance_completed
                    ? 'That was your last step — onboarding complete!'
                    : `Document attached to "${item.title}"`,
            );
            setAttachingId(null);
            await load();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to attach the document'));
        } finally {
            setUploading(false);
        }
    };

    const handleComplete = async (item: OnboardingInstanceItem) => {
        setCompletingId(item.id);
        try {
            const result = await myOnboardingApi.completeItem(item.id);
            toast.success(
                result.instance_completed
                    ? 'That was your last step — onboarding complete!'
                    : `"${item.title}" done`,
            );
            await load();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to complete the step'));
        } finally {
            setCompletingId(null);
        }
    };

    return (
        <MyCard title="Your onboarding" icon={<ClipboardCheck size={14} />}>
            <div className="space-y-4">
                <div>
                    <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                            {settled} of {items.length} steps done
                        </span>
                        <span className="text-xs font-semibold text-teal-400">{percent}%</span>
                    </div>
                    <ProgressBar percent={percent} />
                </div>

                {pending.length === 0 ? (
                    <p className="text-sm text-slate-500">
                        All your steps are settled — HR is wrapping up the rest.
                    </p>
                ) : (
                    <ul className="space-y-2.5">
                        {pending.slice(0, 5).map(item => (
                            <li key={item.id}>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm text-slate-300">{item.title}</span>
                                        {item.due_date && (
                                            <span className="text-xs text-slate-500">Due {item.due_date}</span>
                                        )}
                                    </span>
                                    {selfCompletable(item) ? (
                                        <button
                                            onClick={() => handleComplete(item)}
                                            disabled={completingId === item.id}
                                            className="flex shrink-0 items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-500 disabled:opacity-50"
                                        >
                                            <CheckCircle size={12} />
                                            {completingId === item.id ? 'Saving…' : 'Mark done'}
                                        </button>
                                    ) : item.assignee_role === 'employee' && item.item_type === 'document_upload' ? (
                                        // B4 — your document steps complete by attaching
                                        // the requested document right here.
                                        <button
                                            onClick={() => toggleAttach(item)}
                                            className="flex shrink-0 items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-500"
                                        >
                                            <Upload size={12} />
                                            Attach
                                        </button>
                                    ) : item.assignee_role === 'employee' ? (
                                        // Signature steps complete via the Sign flow (B3).
                                        <span className="shrink-0 text-xs text-slate-500">Awaiting signature</span>
                                    ) : (
                                        <StatusPill status="pending" />
                                    )}
                                </div>
                                {attachingId === item.id && (
                                    <form
                                        onSubmit={e => {
                                            e.preventDefault();
                                            void handleAttach(item);
                                        }}
                                        className="mt-2 space-y-2 rounded-lg border border-slate-700 bg-slate-800/60 p-2.5"
                                    >
                                        <input
                                            value={fileName}
                                            onChange={e => setFileName(e.target.value)}
                                            placeholder="File name (e.g. passport.pdf)"
                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-50 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                                        />
                                        <input
                                            value={fileUrl}
                                            onChange={e => setFileUrl(e.target.value)}
                                            placeholder="Link to the file (optional)"
                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-50 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setAttachingId(null)}
                                                disabled={uploading}
                                                className="px-2 py-1 text-xs text-slate-400 hover:text-slate-50 disabled:opacity-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={uploading || !fileName.trim()}
                                                className="rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {uploading ? 'Attaching…' : 'Attach document'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </MyCard>
    );
};

export default MyOnboardingCard;

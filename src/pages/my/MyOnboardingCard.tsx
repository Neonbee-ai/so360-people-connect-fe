import React, { useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, CheckCircle, Upload } from 'lucide-react';
import { Button, Cluster, Stack, TextField, toast, getErrorMessage } from '@so360/design-system';
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
            <Stack gap="default">
                <Stack gap="tight">
                    <Cluster justify="between">
                        <span className="text-nb-sm text-fg-muted">
                            {settled} of {items.length} steps done
                        </span>
                        <span className="text-nb-sm font-semibold text-primary">{percent}%</span>
                    </Cluster>
                    <ProgressBar percent={percent} />
                </Stack>

                {pending.length === 0 ? (
                    <p className="text-nb-sm text-fg-subtle">
                        All your steps are settled — HR is wrapping up the rest.
                    </p>
                ) : (
                    <Stack gap="tight">
                        {pending.slice(0, 5).map(item => (
                            <Stack key={item.id} gap="tight">
                                <Cluster justify="between">
                                    <span className="min-w-0">
                                        <span className="block truncate text-nb-sm text-fg">{item.title}</span>
                                        {item.due_date && (
                                            <span className="text-nb-sm text-fg-subtle">Due {item.due_date}</span>
                                        )}
                                    </span>
                                    {selfCompletable(item) ? (
                                        <Button
                                            size="sm"
                                            onClick={() => handleComplete(item)}
                                            disabled={completingId === item.id}
                                        >
                                            <CheckCircle size={12} />
                                            {completingId === item.id ? 'Saving…' : 'Mark done'}
                                        </Button>
                                    ) : item.assignee_role === 'employee' && item.item_type === 'document_upload' ? (
                                        // B4 — your document steps complete by attaching
                                        // the requested document right here.
                                        <Button size="sm" onClick={() => toggleAttach(item)}>
                                            <Upload size={12} />
                                            Attach
                                        </Button>
                                    ) : item.assignee_role === 'employee' ? (
                                        // Signature steps complete via the Sign flow (B3).
                                        <span className="shrink-0 text-nb-sm text-fg-subtle">Awaiting signature</span>
                                    ) : (
                                        <StatusPill status="pending" />
                                    )}
                                </Cluster>
                                {attachingId === item.id && (
                                    <form
                                        onSubmit={e => {
                                            e.preventDefault();
                                            void handleAttach(item);
                                        }}
                                        className="rounded-nb border border-line bg-surface p-nb-3"
                                    >
                                        <Stack gap="tight">
                                            <TextField
                                                name={`onboarding-file-name-${item.id}`}
                                                aria-label="File name"
                                                value={fileName}
                                                onChange={e => setFileName(e.target.value)}
                                                placeholder="File name (e.g. passport.pdf)"
                                            />
                                            <TextField
                                                name={`onboarding-file-url-${item.id}`}
                                                aria-label="Link to the file"
                                                value={fileUrl}
                                                onChange={e => setFileUrl(e.target.value)}
                                                placeholder="Link to the file (optional)"
                                            />
                                            <Cluster justify="end">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setAttachingId(null)}
                                                    disabled={uploading}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    size="sm"
                                                    disabled={uploading || !fileName.trim()}
                                                >
                                                    {uploading ? 'Attaching…' : 'Attach document'}
                                                </Button>
                                            </Cluster>
                                        </Stack>
                                    </form>
                                )}
                            </Stack>
                        ))}
                    </Stack>
                )}
            </Stack>
        </MyCard>
    );
};

export default MyOnboardingCard;

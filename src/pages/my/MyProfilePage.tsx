import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { toast } from '@so360/design-system';
import { meService } from '../../services/meService';
import { peopleApi } from '../../services/peopleService';
import type { Person } from '../../types/people';

/**
 * My Profile.
 *
 * The split between what an employee may change and what only HR may change is
 * mirrored from the backend allow-list (MeService.SELF_EDITABLE_FIELDS) rather
 * than reinvented here — the server refuses anything else outright, so showing
 * an editable field the server will reject is how a self-service page becomes
 * a page that fails on save.
 *
 * Read-only fields are still SHOWN. An employee should be able to see their
 * job title and department; they simply cannot set them.
 */

const ReadOnlyRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0 dark:border-slate-700">
        <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
        <span className="text-sm text-slate-800 dark:text-slate-100">{value || '—'}</span>
    </div>
);

const MyProfilePage: React.FC = () => {
    const [person, setPerson] = useState<Person | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [phone, setPhone] = useState('');
    const [emergency, setEmergency] = useState('');

    useEffect(() => {
        peopleApi
            .getMe()
            .then(p => {
                setPerson(p);
                setPhone(p.phone ?? '');
                const ec = (p as unknown as { emergency_contact?: unknown }).emergency_contact;
                setEmergency(typeof ec === 'string' ? ec : ec ? JSON.stringify(ec) : '');
            })
            .catch((err: unknown) => {
                toast.error(
                    err instanceof Error ? err.message : 'Could not load your profile',
                );
            })
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            await meService.updateMyProfile({ phone, emergency_contact: emergency });
            toast.success('Profile updated');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not save your changes');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="py-12 text-center text-sm text-slate-500">Loading…</div>;
    }

    return (
        <div className="space-y-4">
            <PageHeader title="My Profile" subtitle="Your details" />

            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                    <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Employment
                    </h2>
                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                        These are maintained by your administrator.
                    </p>
                    <ReadOnlyRow label="Name" value={person?.full_name} />
                    <ReadOnlyRow label="Employee ID" value={(person as any)?.employee_id} />
                    <ReadOnlyRow label="Job title" value={person?.job_title} />
                    <ReadOnlyRow label="Email" value={person?.email} />
                    <ReadOnlyRow label="Joined" value={(person as any)?.date_of_joining} />
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                    <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Contact details
                    </h2>
                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                        You can keep these up to date yourself.
                    </p>

                    <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                        Phone
                    </label>
                    <input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />

                    <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                        Emergency contact
                    </label>
                    <input
                        value={emergency}
                        onChange={e => setEmergency(e.target.value)}
                        placeholder="Name and number"
                        className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />

                    <button
                        onClick={save}
                        disabled={saving}
                        className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        <Save size={16} /> {saving ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MyProfilePage;

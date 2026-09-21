import React, { useEffect, useState } from 'react';
import { Save, BadgeCheck, Phone } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { toast } from '@so360/design-system';
import { meService } from '../../services/meService';
import { peopleApi } from '../../services/peopleService';
import type { Person } from '../../types/people';
import { MyCard, Skeleton, primaryBtn, inputCls, labelCls } from './myUi';

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
    <div className="flex items-center justify-between border-b border-slate-800 py-2.5 last:border-0">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-sm text-slate-50">{value || '—'}</span>
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
        return (
            <div className="p-6 space-y-5">
                <PageHeader title="My Profile" subtitle="Your details" />
                <Skeleton rows={3} />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-5">
            <PageHeader title="My Profile" subtitle="Your details" />

            <div className="grid gap-4 md:grid-cols-2">
                <MyCard title="Employment" icon={<BadgeCheck size={14} />}>
                    <p className="mb-3 text-xs text-slate-500">
                        These are maintained by your administrator.
                    </p>
                    <ReadOnlyRow label="Name" value={person?.full_name} />
                    <ReadOnlyRow label="Employee ID" value={(person as any)?.employee_id} />
                    <ReadOnlyRow label="Job title" value={person?.job_title} />
                    <ReadOnlyRow label="Email" value={person?.email} />
                    <ReadOnlyRow label="Joined" value={(person as any)?.date_of_joining} />
                </MyCard>

                <MyCard title="Contact details" icon={<Phone size={14} />}>
                    <p className="mb-3 text-xs text-slate-500">
                        You can keep these up to date yourself.
                    </p>

                    <label className={labelCls}>Phone</label>
                    <input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className={`${inputCls} mb-3`}
                    />

                    <label className={labelCls}>Emergency contact</label>
                    <input
                        value={emergency}
                        onChange={e => setEmergency(e.target.value)}
                        placeholder="Name and number"
                        className={`${inputCls} mb-4`}
                    />

                    <button onClick={save} disabled={saving} className={primaryBtn}>
                        <Save size={16} /> {saving ? 'Saving…' : 'Save changes'}
                    </button>
                </MyCard>
            </div>
        </div>
    );
};

export default MyProfilePage;

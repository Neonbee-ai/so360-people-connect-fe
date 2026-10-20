import React, { useEffect, useState } from 'react';
import { Save, BadgeCheck, Phone } from 'lucide-react';
import { Button, Cluster, DashboardPageTemplate, Grid, Stack, TextField, toast } from '@so360/design-system';
import { meService } from '../../services/meService';
import { peopleApi } from '../../services/peopleService';
import type { Person } from '../../types/people';
import { MyCard, Skeleton } from './myUi';

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
    <Cluster justify="between">
        <span className="text-nb-sm text-fg-subtle">{label}</span>
        <span className="text-nb-sm text-fg">{value || '—'}</span>
    </Cluster>
);

interface EmergencyContact { name: string; phone: string; relationship: string }
const EMPTY_CONTACT: EmergencyContact = { name: '', phone: '', relationship: '' };

/**
 * `people.emergency_contact` is JSONB ({ name, phone, relationship }). Older
 * rows may hold a plain string (treated as the name) or `{}` / null.
 */
const toContact = (ec: unknown): EmergencyContact => {
    if (typeof ec === 'string') return { ...EMPTY_CONTACT, name: ec };
    if (ec && typeof ec === 'object') {
        const o = ec as Record<string, unknown>;
        const str = (v: unknown) => (typeof v === 'string' ? v : '');
        return { name: str(o.name), phone: str(o.phone), relationship: str(o.relationship ?? o.relation) };
    }
    return { ...EMPTY_CONTACT };
};

const MyProfilePage: React.FC = () => {
    const [person, setPerson] = useState<Person | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [phone, setPhone] = useState('');
    const [emergency, setEmergency] = useState<EmergencyContact>({ ...EMPTY_CONTACT });

    useEffect(() => {
        peopleApi
            .getMe()
            .then(p => {
                setPerson(p);
                setPhone(p.phone ?? '');
                setEmergency(toContact((p as unknown as { emergency_contact?: unknown }).emergency_contact));
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
            const emergency_contact = {
                name: emergency.name.trim(),
                phone: emergency.phone.trim(),
                relationship: emergency.relationship.trim(),
            };
            await meService.updateMyProfile({ phone, emergency_contact });
            toast.success('Profile updated');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not save your changes');
        } finally {
            setSaving(false);
        }
    };

    return (
        <DashboardPageTemplate
            title="My Profile"
            description="Your details"
            primary={
                loading ? (
                    <Skeleton rows={3} />
                ) : (
                    <Grid columns={2}>
                        <MyCard title="Employment" icon={<BadgeCheck size={14} />}>
                            <Stack gap="tight">
                                <p className="text-nb-sm text-fg-subtle">These are maintained by your administrator.</p>
                                <ReadOnlyRow label="Name" value={person?.full_name} />
                                <ReadOnlyRow label="Employee ID" value={(person as any)?.employee_id} />
                                <ReadOnlyRow label="Job title" value={person?.job_title} />
                                <ReadOnlyRow label="Email" value={person?.email} />
                                <ReadOnlyRow label="Joined" value={(person as any)?.date_of_joining} />
                            </Stack>
                        </MyCard>

                        <MyCard title="Contact details" icon={<Phone size={14} />}>
                            <Stack gap="default">
                                <p className="text-nb-sm text-fg-subtle">You can keep these up to date yourself.</p>
                                <TextField
                                    name="phone"
                                    label="Phone"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                />
                                <TextField
                                    name="emergency_contact_name"
                                    label="Emergency contact name"
                                    value={emergency.name}
                                    onChange={e => setEmergency(c => ({ ...c, name: e.target.value }))}
                                />
                                <TextField
                                    name="emergency_contact_phone"
                                    label="Emergency contact phone"
                                    value={emergency.phone}
                                    onChange={e => setEmergency(c => ({ ...c, phone: e.target.value }))}
                                />
                                <TextField
                                    name="emergency_contact_relationship"
                                    label="Relationship"
                                    value={emergency.relationship}
                                    onChange={e => setEmergency(c => ({ ...c, relationship: e.target.value }))}
                                />
                                <Cluster>
                                    <Button onClick={save} disabled={saving}>
                                        <Save size={16} /> {saving ? 'Saving…' : 'Save changes'}
                                    </Button>
                                </Cluster>
                            </Stack>
                        </MyCard>
                    </Grid>
                )
            }
        />
    );
};

export default MyProfilePage;

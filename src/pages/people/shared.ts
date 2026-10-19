import type { Person, AccessStatus, InvitationStatus } from '../../types/people';

export const DEFAULT_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'];

// Access-status badge — mirrors the StatusBadge colour vocabulary used across
// this module (emerald=ok, amber=pending, slate=neutral, rose=blocked). A
// 'blocked' login_status always wins over access_status.
export const ACCESS_BADGE: Record<string, { label: string; className: string }> = {
    active: { label: 'Has Access', className: 'bg-success/10 text-success border-success/30' },
    pending: { label: 'Invitation Pending', className: 'bg-warning/10 text-warning border-warning/30' },
    no_access: { label: 'No Access', className: 'bg-fg-subtle/10 text-fg-muted border-fg-subtle/30' },
    blocked: { label: 'Blocked', className: 'bg-danger/10 text-danger border-danger/30' },
};

export const resolveAccessBadge = (person: Pick<Person, 'access_status' | 'login_status'>) => {
    // Blocked is a hard override regardless of access_status.
    if (person.login_status === 'blocked') return ACCESS_BADGE.blocked;
    const key: AccessStatus = person.access_status ?? 'no_access';
    return ACCESS_BADGE[key] ?? ACCESS_BADGE.no_access;
};

export const INVITATION_LABEL: Record<InvitationStatus, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    expired: 'Expired',
};

/**
 * Pick the org role an invite (or re-invite) should carry.
 *
 * Both invite actions previously used `roles.data[0].id` — the first row the API
 * happened to return. Two things went wrong with that. The role handed to a new
 * user was effectively arbitrary (Guest for some orgs, Admin for others), and
 * because the backend upserts invites on (org_id, email), hitting "Resend"
 * silently OVERWROTE the role an administrator had deliberately chosen.
 *
 * So: keep the person's existing role when they already have one, otherwise use
 * the canonical Employee role. Never guess — returning null surfaces a real error
 * rather than quietly granting the wrong level of access.
 */
export const resolveInviteRoleId = (
    person: Person,
    roles?: Array<{ id: string; name: string }>,
): string | undefined => {
    if (!roles?.length) return undefined;

    const byName = (name?: string | null) =>
        name
            ? roles.find(r => r.name?.toLowerCase().trim() === name.toLowerCase().trim())
            : undefined;

    return (byName(person.system_role) ?? byName('Employee'))?.id;
};

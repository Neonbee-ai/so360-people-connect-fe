import React, { useState, useEffect, useMemo } from 'react';
import { Combobox } from '@so360/design-system';
import { apiContext } from '../services/apiClient';

type User = {
  id: string;
  email: string;
  full_name?: string;
  name?: string;
  avatar_url?: string;
};

const _win = typeof window !== 'undefined' ? (window as any) : undefined;
// Same Core base as departmentScopeService — a relative '/v1/...' hits the MFE host, not Core.
const CORE_API_BASE =
  (_win && _win.VITE_SO360_CORE_API) ||
  (import.meta as any).env?.VITE_SO360_CORE_API ||
  '/core-api';

type Props = {
  value?: string | null;
  onChange: (userId: string | null) => void;
  orgId?: string;
  tenantId?: string;
  placeholder?: string;
};

export default function UserSelector({ value, onChange, placeholder = 'Select user...' }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const orgId = apiContext.getOrgId();
    const tenantId = apiContext.getTenantId();
    const token = apiContext.getAccessToken();

    fetch(`${CORE_API_BASE}/v1/tenancy/members?org_id=${encodeURIComponent(orgId)}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
        'X-Org-Id': orgId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then(async (res) => {
        // A 401/403/500 body is not a member list — surface the server's reason
        // (permission/auth) instead of hiding it behind "No users found".
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message || `Could not load users (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        // Core API returns { members: [...], invites: [...] } or array directly
        const members = Array.isArray(data) ? data : data.members || data.data || [];
        const mapped: User[] = members.map((m: any) => ({
          id: m.user_id || m.id,
          email: m.email || '',
          full_name: m.full_name || m.name || m.email || '',
          avatar_url: m.avatar_url,
        }));
        setUsers(mapped);
      })
      .catch((err) => {
        if (cancelled) return;
        setUsers([]);
        setError(err instanceof Error ? err.message : 'Could not load users');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // comb-exception: Comb Combobox options are text-only (label + description), so the
  // member avatar thumbnail is dropped; the email is shown as the option description.
  const options = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: u.full_name || u.email,
        description: u.full_name ? u.email : undefined,
      })),
    [users],
  );

  return (
    <Combobox
      name="user"
      aria-label="User"
      options={options}
      value={value || null}
      placeholder={placeholder}
      clearable
      emptyText={
        loading
          ? 'Loading users...'
          : error
            ?? (users.length === 0
              ? 'No users in this organization yet. Use "Invite as New User" instead.'
              : 'No users match. Search by name or email.')
      }
      filter={(o: { label: string; description?: string }, q: string) => {
        const lower = q.trim().toLowerCase();
        return o.label.toLowerCase().includes(lower) || !!o.description?.toLowerCase().includes(lower);
      }}
      onChange={(id: string | null) => onChange(id)}
    />
  );
}

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const orgId = apiContext.getOrgId();
    const tenantId = apiContext.getTenantId();
    const token = apiContext.getAccessToken();

    fetch(`/v1/tenancy/members?org_id=${orgId}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
        'X-Org-Id': orgId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then((res) => res.json())
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
      .catch(() => {
        if (!cancelled) setUsers([]);
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
      emptyText={loading ? 'Loading users...' : 'No users found'}
      filter={(o: { label: string; description?: string }, q: string) => {
        const lower = q.trim().toLowerCase();
        return o.label.toLowerCase().includes(lower) || !!o.description?.toLowerCase().includes(lower);
      }}
      onChange={(id: string | null) => onChange(id)}
    />
  );
}

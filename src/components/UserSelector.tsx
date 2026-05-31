import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const selectedUser = users.find((u) => u.id === value);

  const filtered = useMemo(() => {
    if (!search) return users;
    const lower = search.toLowerCase();
    return users.filter(
      (u) =>
        (u.full_name || '').toLowerCase().includes(lower) ||
        u.email.toLowerCase().includes(lower)
    );
  }, [users, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-50 cursor-pointer focus-within:border-teal-500"
        onClick={() => {
          setOpen(!open);
          if (!open) setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {open ? (
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={selectedUser ? (selectedUser.full_name || selectedUser.email) : placeholder}
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-slate-400"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`flex-1 truncate ${selectedUser ? 'text-white' : 'text-slate-400'}`}>
            {selectedUser ? (selectedUser.full_name || selectedUser.email) : placeholder}
          </span>
        )}
        {value && !open ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="ml-2 text-slate-400 hover:text-white"
          >
            &times;
          </button>
        ) : (
          <svg className="ml-2 w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
          </svg>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-lg">
          {loading ? (
            <div className="px-3 py-2 text-sm text-slate-400">Loading users...</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No users found</div>
          ) : (
            filtered.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelect(user.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 flex items-center gap-2 ${
                  user.id === value ? 'bg-slate-700/50 text-teal-400' : 'text-slate-50'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs shrink-0 overflow-hidden">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (user.full_name || user.email || '?')[0].toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{user.full_name || user.email}</div>
                  {user.full_name && (
                    <div className="text-xs text-slate-400 truncate">{user.email}</div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/apiClient', () => ({
  apiContext: { getOrgId: () => 'o1', getTenantId: () => 't1', getAccessToken: () => 'tok' },
}));

import UserSelector from './UserSelector';

const respond = (ok: boolean, status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) });

describe('UserSelector', () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => { globalThis.fetch = realFetch; });

  it('Given the members call is forbidden / When opened / Then the real error shows, not "No users found"', async () => {
    globalThis.fetch = respond(false, 403, { message: 'Missing permission members.read' }) as any;
    render(<UserSelector onChange={() => {}} />);
    fireEvent.click(screen.getByText('Select user...'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Missing permission'));
    expect(screen.queryByText('No users found')).toBeNull();
  });

  it('Given an org with no members / When opened / Then a helpful empty message shows', async () => {
    globalThis.fetch = respond(true, 200, { members: [] }) as any;
    render(<UserSelector onChange={() => {}} />);
    fireEvent.click(screen.getByText('Select user...'));
    await waitFor(() => expect(screen.getByText(/No users in this organization yet/)).toBeTruthy());
  });

  it('Given members / When searching by email / Then matching users are listed', async () => {
    globalThis.fetch = respond(true, 200, { members: [{ user_id: 'u1', email: 'a@x.com', full_name: 'Asha' }, { user_id: 'u2', email: 'b@x.com', full_name: 'Bo' }] }) as any;
    render(<UserSelector onChange={() => {}} />);
    fireEvent.click(screen.getByText('Select user...'));
    await waitFor(() => screen.getByText('Asha'));
    fireEvent.change(screen.getByPlaceholderText('Select user...'), { target: { value: 'b@x' } });
    expect(screen.queryByText('Asha')).toBeNull();
    expect(screen.getByText('Bo')).toBeTruthy();
  });
});

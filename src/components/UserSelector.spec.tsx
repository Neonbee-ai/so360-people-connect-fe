import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../services/apiClient', () => ({
  apiContext: {
    getBaseUrl: vi.fn(() => '/people-api'),
    getTenantId: vi.fn(() => 't1'),
    getOrgId: vi.fn(() => 'o1'),
    getAccessToken: vi.fn(() => ''),
  },
}));

import UserSelector from './UserSelector';

const mockUsers = [
  { user_id: 'u1', email: 'alice@test.com', full_name: 'Alice Smith' },
  { user_id: 'u2', email: 'bob@test.com', full_name: 'Bob Jones' },
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given UserSelector with no users loaded', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ members: [] }),
    }));
  });

  it('When rendered without value / Then default placeholder is shown', async () => {
    render(<UserSelector value={null} onChange={() => {}} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByPlaceholderText('Select user...')).toBeInTheDocument();
  });

  it('When rendered with custom placeholder / Then it is shown', async () => {
    render(<UserSelector value={null} onChange={() => {}} placeholder="Choose a user" />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByPlaceholderText('Choose a user')).toBeInTheDocument();
  });
});

describe('Given UserSelector with users', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ members: mockUsers }),
    }));
  });

  it('When opened / Then all users are shown in dropdown', async () => {
    render(<UserSelector value={null} onChange={() => {}} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByPlaceholderText('Select user...'));
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('When a user is selected / Then onChange is called with user_id', async () => {
    const onChange = vi.fn();
    render(<UserSelector value={null} onChange={onChange} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByPlaceholderText('Select user...'));
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Alice Smith'));
    expect(onChange).toHaveBeenCalledWith('u1');
  });

  it('When value is set / Then the selected user name is shown', async () => {
    render(<UserSelector value="u1" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('Alice Smith'));
  });

  it('When searching by email / Then only the matching user remains', async () => {
    render(<UserSelector value={null} onChange={() => {}} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByPlaceholderText('Select user...'));
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bob@' } });
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('When clear button is clicked / Then onChange is called with null', async () => {
    const onChange = vi.fn();
    render(<UserSelector value="u1" onChange={onChange} />);
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('Alice Smith'));
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('Given UserSelector with fetch failure', () => {
  it('When fetch fails / Then empty list is shown when opened', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { throw new Error('Failed'); }));
    render(<UserSelector value={null} onChange={() => {}} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByPlaceholderText('Select user...'));
    await waitFor(() => expect(screen.getByText('Failed')).toBeInTheDocument());
    expect(screen.queryByText('No users found')).not.toBeInTheDocument();
  });

  it('Given a 403 from Core / When opened / Then the error is shown instead of "No users found" (Pulse 15be04c2)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: () => Promise.resolve({}) }));
    render(<UserSelector value={null} onChange={() => {}} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByPlaceholderText('Select user...'));
    await waitFor(() => expect(screen.getByText('Could not load users (403)')).toBeInTheDocument());
  });
});

describe('Given UserSelector request target (Pulse 15be04c2)', () => {
  it('When it fetches members / Then it calls the Core base URL, not a relative MFE path', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ members: [] }) });
    vi.stubGlobal('fetch', f);
    render(<UserSelector value={null} onChange={() => {}} />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(String(f.mock.calls[0][0])).toMatch(/^\/core-api\/v1\/tenancy\/members\?org_id=o1$|\/v1\/tenancy\/members\?org_id=o1$/);
    expect(String(f.mock.calls[0][0]).startsWith('/v1/')).toBe(false);
  });
});

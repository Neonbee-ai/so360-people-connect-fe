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
      json: () => Promise.resolve({ members: [] }),
    }));
  });

  it('When rendered without value / Then default placeholder is shown', async () => {
    render(<UserSelector value={null} onChange={() => {}} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByText('Select user...')).toBeInTheDocument();
  });

  it('When rendered with custom placeholder / Then it is shown', async () => {
    render(<UserSelector value={null} onChange={() => {}} placeholder="Choose a user" />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByText('Choose a user')).toBeInTheDocument();
  });
});

describe('Given UserSelector with users', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ members: mockUsers }),
    }));
  });

  it('When opened / Then all users are shown in dropdown', async () => {
    render(<UserSelector value={null} onChange={() => {}} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Select user...'));
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('When a user is selected / Then onChange is called with user_id', async () => {
    const onChange = vi.fn();
    render(<UserSelector value={null} onChange={onChange} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Select user...'));
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Alice Smith'));
    expect(onChange).toHaveBeenCalledWith('u1');
  });

  it('When value is set / Then the selected user name is shown', async () => {
    render(<UserSelector value="u1" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  });

  it('When clear button is clicked / Then onChange is called with null', async () => {
    const onChange = vi.fn();
    render(<UserSelector value="u1" onChange={onChange} />);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.click(screen.getByText('×'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('Given UserSelector with fetch failure', () => {
  it('When fetch fails / Then empty list is shown when opened', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed')));
    render(<UserSelector value={null} onChange={() => {}} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Select user...'));
    await waitFor(() => expect(screen.getByText('No users found')).toBeInTheDocument());
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../services/apiClient', () => ({
  apiContext: {
    getOrgId: () => 'o1',
    getTenantId: () => 't1',
    getAccessToken: () => 'tok',
  },
  api: {
    getHeadersRaw: () => ({ 'Content-Type': 'application/json', 'X-Tenant-Id': 't1', 'X-Org-Id': 'o1', Authorization: 'Bearer tok' }),
  },
}));

import UserSelector from '../components/UserSelector';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({
      members: [
        { user_id: 'u1', email: 'alice@test.com', full_name: 'Alice Smith', avatar_url: null },
        { user_id: 'u2', email: 'bob@test.com', full_name: 'Bob Jones', avatar_url: 'http://avatar.png' },
      ],
    }),
  }));
});

describe('UserSelector', () => {
  describe('Given users are loaded', () => {
    it('When dropdown is opened / Then it shows the user list', async () => {
      render(<UserSelector value={null} onChange={() => {}} />);
      await waitFor(() => expect(fetch).toHaveBeenCalled());
      fireEvent.click(screen.getByText('Select user...'));
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });

    it('When a user is selected / Then onChange is called with the user id', async () => {
      const onChange = vi.fn();
      render(<UserSelector value={null} onChange={onChange} />);
      await waitFor(() => expect(fetch).toHaveBeenCalled());
      fireEvent.click(screen.getByText('Select user...'));
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Alice Smith'));
      expect(onChange).toHaveBeenCalledWith('u1');
    });

    it('When a value is set / Then the selected user name is shown', async () => {
      render(<UserSelector value="u1" onChange={() => {}} />);
      await waitFor(() => expect(fetch).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    });

    it('When the clear button is clicked / Then onChange is called with null', async () => {
      const onChange = vi.fn();
      render(<UserSelector value="u1" onChange={onChange} />);
      await waitFor(() => expect(fetch).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      fireEvent.click(screen.getByText('×'));
      expect(onChange).toHaveBeenCalledWith(null);
    });

    it('When searching for a user / Then the list is filtered', async () => {
      render(<UserSelector value={null} onChange={() => {}} />);
      await waitFor(() => expect(fetch).toHaveBeenCalled());
      fireEvent.click(screen.getByText('Select user...'));
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText('Select user...'), { target: { value: 'bob' } });
      expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });
  });

  describe('Given the fetch fails', () => {
    it('When the API returns an error / Then the list is empty', async () => {
      (fetch as any).mockImplementation(async () => { throw new Error('fail'); });
      render(<UserSelector value={null} onChange={() => {}} />);
      await waitFor(() => expect(fetch).toHaveBeenCalled());
      fireEvent.click(screen.getByText('Select user...'));
      await waitFor(() => expect(screen.getByText('No users found')).toBeInTheDocument());
    });
  });

  describe('Given the API returns array format', () => {
    it('When the response is a plain array / Then it maps users correctly', async () => {
      (fetch as any).mockResolvedValue({
        json: () => Promise.resolve([
          { id: 'u3', email: 'charlie@test.com', name: 'Charlie' },
        ]),
      });
      render(<UserSelector value={null} onChange={() => {}} />);
      await waitFor(() => expect(fetch).toHaveBeenCalled());
      fireEvent.click(screen.getByText('Select user...'));
      await waitFor(() => expect(screen.getByText('Charlie')).toBeInTheDocument());
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

/**
 * NotificationSenderPage — BDD specs.
 *
 * Lets an HR admin pick which connected email account sends People
 * Connect's hr_* notification family. Behaviours worth pinning: the
 * connections list renders with the currently-designated one marked, the
 * empty state shows when the org has no connections at all, Save PATCHes
 * with the selected connection id, and Clear PATCHes with null.
 */

vi.mock('../../services/notificationSenderService', () => ({
  notificationSenderApi: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

let mockShell: any;

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => mockShell,
}));

import NotificationSenderPage from './NotificationSenderPage';
import { notificationSenderApi } from '../../services/notificationSenderService';

const mockApi = notificationSenderApi as any;

const renderPage = () =>
  render(
    <MemoryRouter>
      <NotificationSenderPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockShell = { permissionsLoaded: true, hasPermission: () => true };
});

describe('Given the org has connected email accounts', () => {
  beforeEach(() => {
    mockApi.get.mockResolvedValue({
      connections: [
        { id: 'conn1', piece_name: 'gmail', display_name: 'HR Gmail', designated_purpose: 'people' },
        { id: 'conn2', piece_name: 'outlook', display_name: 'Ops Outlook', designated_purpose: null },
      ],
      designatedConnectionId: 'conn1',
    });
  });

  it('When the page loads / Then the connections render and the designated one is marked', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('HR Gmail')).toBeInTheDocument());
    expect(screen.getByText('Ops Outlook')).toBeInTheDocument();
    expect(screen.getByText('Currently designated')).toBeInTheDocument();
  });

  it('When a different connection is selected and Save is clicked / Then it PATCHes with that connection_id', async () => {
    mockApi.set.mockResolvedValue({
      connections: [
        { id: 'conn1', piece_name: 'gmail', display_name: 'HR Gmail', designated_purpose: null },
        { id: 'conn2', piece_name: 'outlook', display_name: 'Ops Outlook', designated_purpose: 'people' },
      ],
      designatedConnectionId: 'conn2',
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Ops Outlook')).toBeInTheDocument());

    // Radios render in order: platform default, conn1, conn2 — select conn2.
    fireEvent.click(screen.getAllByRole('radio')[2]);
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(mockApi.set).toHaveBeenCalledWith('conn2'));
  });

  it('When Clear is clicked / Then it PATCHes with null', async () => {
    mockApi.set.mockResolvedValue({
      connections: [
        { id: 'conn1', piece_name: 'gmail', display_name: 'HR Gmail', designated_purpose: null },
        { id: 'conn2', piece_name: 'outlook', display_name: 'Ops Outlook', designated_purpose: null },
      ],
      designatedConnectionId: null,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('HR Gmail')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Clear (use platform default)'));

    await waitFor(() => expect(mockApi.set).toHaveBeenCalledWith(null));
  });

  it('When Save is clicked without changing the selection / Then Save stays disabled', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('HR Gmail')).toBeInTheDocument());

    expect(screen.getByText('Save')).toBeDisabled();
  });
});

describe('Given the org has zero connected email accounts', () => {
  it('When the page loads / Then the empty state guides the admin to Connect, with no crash', async () => {
    mockApi.get.mockResolvedValue({ connections: [], designatedConnectionId: null });
    renderPage();
    await waitFor(() => expect(screen.getByText('No connected email accounts')).toBeInTheDocument());
    expect(screen.getByText(/Connect an email account first/)).toBeInTheDocument();
    expect(screen.getByText('Go to Connect')).toBeInTheDocument();
  });
});

describe('Given Connect is unreachable', () => {
  it('When the page loads / Then a clear error is shown with a Retry action', async () => {
    mockApi.get.mockRejectedValue(new Error('Connect service unavailable'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Couldn't load connected email accounts")).toBeInTheDocument(),
    );
    expect(screen.getByText('Connect service unavailable')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });
});

describe('Given a viewer without org_policy.update', () => {
  it('When the page loads / Then Save/Clear controls are hidden', async () => {
    mockShell = { permissionsLoaded: true, hasPermission: (code: string) => code !== 'org_policy.update' };
    mockApi.get.mockResolvedValue({
      connections: [
        { id: 'conn1', piece_name: 'gmail', display_name: 'HR Gmail', designated_purpose: 'people' },
      ],
      designatedConnectionId: 'conn1',
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('HR Gmail')).toBeInTheDocument());
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(screen.queryByText('Clear (use platform default)')).not.toBeInTheDocument();
  });
});

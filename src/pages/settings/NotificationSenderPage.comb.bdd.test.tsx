import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/notificationSenderService', () => ({
  notificationSenderApi: { get: vi.fn(), set: vi.fn() },
}));

let mockShell: any;
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => mockShell }));

const { toastMock } = vi.hoisted(() => ({ toastMock: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@so360/design-system', async () => ({ ...(await import('../../test/__mocks__/design-system')), toast: toastMock }));

import NotificationSenderPage from './NotificationSenderPage';
import { notificationSenderApi } from '../../services/notificationSenderService';

const api = notificationSenderApi as any;
const conns = [
  { id: 'conn1', piece_name: 'gmail', display_name: 'HR Gmail', designated_purpose: 'people' },
  { id: 'conn2', piece_name: 'outlook', display_name: 'Ops Outlook', designated_purpose: null },
];
const renderPage = () => render(<MemoryRouter><NotificationSenderPage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  mockShell = { permissionsLoaded: true, hasPermission: () => true };
});

describe('Given NotificationSenderPage built on Comb SettingsPageTemplate', () => {
  it('When connections load / Then the title, accounts and designated badge are shown', async () => {
    api.get.mockResolvedValue({ connections: conns, designatedConnectionId: 'conn1' });
    renderPage();
    expect(await screen.findByText('Notification Sender')).toBeInTheDocument();
    expect(screen.getByText('HR Gmail')).toBeInTheDocument();
    expect(screen.getByText('Currently designated')).toBeInTheDocument();
  });

  it('When there are no connections / Then the empty state offers Go to Connect', async () => {
    api.get.mockResolvedValue({ connections: [], designatedConnectionId: null });
    renderPage();
    expect(await screen.findByText('No connected email accounts')).toBeInTheDocument();
    expect(screen.getByText('Go to Connect')).toBeInTheDocument();
  });

  it('When another account is selected and Save clicked / Then set() is called with its id and a success toast shows', async () => {
    api.get.mockResolvedValue({ connections: conns, designatedConnectionId: 'conn1' });
    api.set.mockResolvedValue({ connections: conns, designatedConnectionId: 'conn2' });
    renderPage();
    await screen.findByText('Ops Outlook');
    fireEvent.click(screen.getAllByRole('radio')[2]);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(api.set).toHaveBeenCalledWith('conn2'));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Notification sender updated'));
  });

  it('When Clear is clicked / Then set(null) is called', async () => {
    api.get.mockResolvedValue({ connections: conns, designatedConnectionId: 'conn1' });
    api.set.mockResolvedValue({ connections: conns, designatedConnectionId: null });
    renderPage();
    await screen.findByText('HR Gmail');
    fireEvent.click(screen.getByText('Clear (use platform default)'));
    await waitFor(() => expect(api.set).toHaveBeenCalledWith(null));
  });

  it('When the viewer lacks org_policy.update / Then Save and Clear are hidden', async () => {
    mockShell = { permissionsLoaded: true, hasPermission: (c: string) => c !== 'org_policy.update' };
    api.get.mockResolvedValue({ connections: conns, designatedConnectionId: 'conn1' });
    renderPage();
    await screen.findByText('HR Gmail');
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(screen.queryByText('Clear (use platform default)')).not.toBeInTheDocument();
  });

  it('When saving fails / Then an error toast is shown', async () => {
    api.get.mockResolvedValue({ connections: conns, designatedConnectionId: 'conn1' });
    api.set.mockRejectedValue(new Error('nope'));
    renderPage();
    await screen.findByText('Ops Outlook');
    fireEvent.click(screen.getAllByRole('radio')[2]);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });
});

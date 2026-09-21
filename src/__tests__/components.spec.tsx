import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

describe('StatCard', () => {
  it('Given label and value / When rendered / Then it shows label and value', async () => {
    const { default: StatCard } = await import('../components/StatCard');
    const Icon = (props: any) => React.createElement('svg', props);
    render(<StatCard label="Total People" value={42} icon={Icon} />);
    expect(screen.getByText('Total People')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('Given a trend / When rendered / Then it shows the trend value', async () => {
    const { default: StatCard } = await import('../components/StatCard');
    const Icon = (props: any) => React.createElement('svg', props);
    render(<StatCard label="Growth" value="15%" icon={Icon} trend={{ value: 5, positive: true }} color="emerald" />);
    expect(screen.getByText('+5%')).toBeInTheDocument();
  });

  it('Given a negative trend / When rendered / Then it shows negative value', async () => {
    const { default: StatCard } = await import('../components/StatCard');
    const Icon = (props: any) => React.createElement('svg', props);
    render(<StatCard label="Decline" value="5%" icon={Icon} trend={{ value: -3, positive: false }} color="rose" />);
    expect(screen.getByText('-3%')).toBeInTheDocument();
  });
});

describe('ModuleNav', () => {
  it('Given the navigation / When rendered / Then it shows all sections', async () => {
    const { default: ModuleNav } = await import('../components/ModuleNav');
    render(<MemoryRouter initialEntries={['/dashboard']}><ModuleNav /></MemoryRouter>);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('People & Organization')).toBeInTheDocument();
    expect(screen.getByText('Resource Management')).toBeInTheDocument();
    expect(screen.getByText('Leave Management')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('Given the navigation / When on dashboard route / Then Dashboard link is active', async () => {
    const { default: ModuleNav } = await import('../components/ModuleNav');
    render(<MemoryRouter initialEntries={['/dashboard']}><ModuleNav /></MemoryRouter>);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});

describe('LeaveWorkflowStepper', () => {
  it('Given status draft / When rendered / Then Draft step is current', async () => {
    const { LeaveWorkflowStepper } = await import('../components/LeaveWorkflowStepper');
    render(<LeaveWorkflowStepper status="draft" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('Given status submitted / When rendered / Then Submitted step is current', async () => {
    const { LeaveWorkflowStepper } = await import('../components/LeaveWorkflowStepper');
    render(<LeaveWorkflowStepper status="submitted" />);
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });

  it('Given status pending / When rendered / Then it maps to submitted', async () => {
    const { LeaveWorkflowStepper } = await import('../components/LeaveWorkflowStepper');
    render(<LeaveWorkflowStepper status="pending" />);
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });

  it('Given status approved / When rendered / Then Approved step is current', async () => {
    const { LeaveWorkflowStepper } = await import('../components/LeaveWorkflowStepper');
    render(<LeaveWorkflowStepper status="approved" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('Given status rejected / When rendered / Then it shows the rejection flow', async () => {
    const { LeaveWorkflowStepper } = await import('../components/LeaveWorkflowStepper');
    render(<LeaveWorkflowStepper status="rejected" />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('Given status cancelled / When rendered / Then it shows Cancelled', async () => {
    const { LeaveWorkflowStepper } = await import('../components/LeaveWorkflowStepper');
    render(<LeaveWorkflowStepper status="cancelled" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });
});

describe('UserSelector', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Given the selector / When rendered without value / Then it shows placeholder', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ members: [] }),
    }));
    const { default: UserSelector } = await import('../components/UserSelector');
    render(<UserSelector value={null} onChange={() => {}} placeholder="Pick user" />);
    expect(screen.getByText('Pick user')).toBeInTheDocument();
  });

  it('Given users are loaded / When the dropdown is opened / Then it shows users', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ members: [
        { user_id: 'u1', email: 'alice@test.com', full_name: 'Alice Smith' },
        { user_id: 'u2', email: 'bob@test.com', full_name: 'Bob Jones' },
      ]}),
    }));
    const { default: UserSelector } = await import('../components/UserSelector');
    render(<UserSelector value={null} onChange={() => {}} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Select user...'));
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('Given a user is selected / When rendered / Then it shows the user name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ members: [
        { user_id: 'u1', email: 'alice@test.com', full_name: 'Alice Smith' },
      ]}),
    }));
    const { default: UserSelector } = await import('../components/UserSelector');
    render(<UserSelector value="u1" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  });

  it('Given a user is selected / When clear is clicked / Then it calls onChange with null', async () => {
    const handleChange = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ members: [
        { user_id: 'u1', email: 'alice@test.com', full_name: 'Alice' },
      ]}),
    }));
    const { default: UserSelector } = await import('../components/UserSelector');
    render(<UserSelector value="u1" onChange={handleChange} />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByText('×'));
    expect(handleChange).toHaveBeenCalledWith(null);
  });

  it('Given users are loaded / When a user is selected / Then it calls onChange', async () => {
    const handleChange = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ members: [
        { user_id: 'u1', email: 'alice@test.com', full_name: 'Alice' },
      ]}),
    }));
    const { default: UserSelector } = await import('../components/UserSelector');
    render(<UserSelector value={null} onChange={handleChange} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Select user...'));
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Alice'));
    expect(handleChange).toHaveBeenCalledWith('u1');
  });

  it('Given fetch fails / When rendered / Then it shows empty list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { throw new Error('fail'); }));
    const { default: UserSelector } = await import('../components/UserSelector');
    render(<UserSelector value={null} onChange={() => {}} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Select user...'));
    await waitFor(() => expect(screen.getByText('No users found')).toBeInTheDocument());
  });
});

describe('DepartmentSelector', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Given the selector / When rendered without value / Then it shows placeholder', async () => {
    vi.mock('../services/departmentsService', () => ({
      departmentsApi: { getTree: vi.fn().mockResolvedValue({ data: [] }) },
      Department: {},
    }));
    const { default: DepartmentSelector } = await import('../components/DepartmentSelector');
    render(<DepartmentSelector value="" onChange={() => {}} placeholder="Pick dept" />);
    expect(screen.getByText('Pick dept')).toBeInTheDocument();
  });

  it('Given departments are loaded / When opened / Then it shows departments', async () => {
    const { departmentsApi } = await import('../services/departmentsService');
    (departmentsApi.getTree as any).mockResolvedValue({
      data: [
        { id: 'd1', name: 'Engineering', code: 'ENG', is_active: true, children: [] },
        { id: 'd2', name: 'Sales', code: 'SAL', is_active: true, children: [] },
      ],
    });
    const { default: DepartmentSelector } = await import('../components/DepartmentSelector');
    render(<DepartmentSelector value="" onChange={() => {}} />);
    await waitFor(() => {
      fireEvent.click(screen.getByText('Select department...'));
    });
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    expect(screen.getByText('Sales')).toBeInTheDocument();
  });

  it('Given a department is selected / When rendered / Then it shows the dept name', async () => {
    const { departmentsApi } = await import('../services/departmentsService');
    (departmentsApi.getTree as any).mockResolvedValue({
      data: [{ id: 'd1', name: 'Engineering', code: 'ENG', is_active: true, children: [] }],
    });
    const { default: DepartmentSelector } = await import('../components/DepartmentSelector');
    render(<DepartmentSelector value="d1" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
  });

  it('Given departments are loaded / When one is clicked / Then it calls onChange', async () => {
    const handleChange = vi.fn();
    const { departmentsApi } = await import('../services/departmentsService');
    (departmentsApi.getTree as any).mockResolvedValue({
      data: [{ id: 'd1', name: 'Engineering', code: 'ENG', is_active: true, children: [] }],
    });
    const { default: DepartmentSelector } = await import('../components/DepartmentSelector');
    render(<DepartmentSelector value="" onChange={handleChange} />);
    await waitFor(() => {
      fireEvent.click(screen.getByText('Select department...'));
    });
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Engineering'));
    expect(handleChange).toHaveBeenCalledWith('d1');
  });

  it('Given allowClear is true and value selected / When clear is clicked / Then it calls onChange with null', async () => {
    const handleChange = vi.fn();
    const { departmentsApi } = await import('../services/departmentsService');
    (departmentsApi.getTree as any).mockResolvedValue({
      data: [{ id: 'd1', name: 'Engineering', code: 'ENG', is_active: true, children: [] }],
    });
    const { default: DepartmentSelector } = await import('../components/DepartmentSelector');
    render(<DepartmentSelector value="d1" onChange={handleChange} allowClear />);
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    fireEvent.click(screen.getByText('×'));
    expect(handleChange).toHaveBeenCalledWith(null);
  });
});

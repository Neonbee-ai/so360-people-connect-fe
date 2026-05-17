import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import StatCard from './StatCard';

const MockIcon = (props: any) => React.createElement('svg', { 'data-testid': 'stat-icon', ...props });

describe('Given StatCard with required props', () => {
  it('When rendered / Then it shows the label', () => {
    render(<StatCard label="Active People" value={42} icon={MockIcon} />);
    expect(screen.getByText('Active People')).toBeInTheDocument();
  });

  it('When rendered / Then it shows the numeric value', () => {
    render(<StatCard label="Active People" value={42} icon={MockIcon} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('When rendered / Then the icon is present', () => {
    render(<StatCard label="Hours" value="340h" icon={MockIcon} />);
    expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
  });

  it('When value is a string / Then it is displayed as-is', () => {
    render(<StatCard label="Utilization" value="72%" icon={MockIcon} />);
    expect(screen.getByText('72%')).toBeInTheDocument();
  });
});

describe('Given StatCard with a positive trend', () => {
  it('When rendered / Then it shows the trend with + prefix', () => {
    render(<StatCard label="Growth" value={15} icon={MockIcon} trend={{ value: 5, positive: true }} />);
    expect(screen.getByText('+5%')).toBeInTheDocument();
  });
});

describe('Given StatCard with a negative trend', () => {
  it('When rendered / Then it shows the trend without + prefix', () => {
    render(<StatCard label="Decline" value={5} icon={MockIcon} trend={{ value: -3, positive: false }} />);
    expect(screen.getByText('-3%')).toBeInTheDocument();
  });
});

describe('Given StatCard without a trend', () => {
  it('When no trend is provided / Then no trend indicator is rendered', () => {
    const { container } = render(<StatCard label="Total" value={100} icon={MockIcon} />);
    expect(container.querySelectorAll('span').length).toBe(0);
  });
});

describe('Given StatCard with different color variants', () => {
  it('When color is rose / Then the component renders without error', () => {
    render(<StatCard label="Alerts" value={3} icon={MockIcon} color="rose" />);
    expect(screen.getByText('Alerts')).toBeInTheDocument();
  });

  it('When color is amber / Then the component renders without error', () => {
    render(<StatCard label="Pending" value={7} icon={MockIcon} color="amber" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import EmptyState from './EmptyState';

const MockIcon = (props: any) => React.createElement('svg', { 'data-testid': 'empty-icon', ...props });

describe('Given EmptyState with required props', () => {
  it('When rendered / Then it shows the title', () => {
    render(<EmptyState icon={MockIcon} title="No Records Found" description="Try adding some." />);
    expect(screen.getByText('No Records Found')).toBeInTheDocument();
  });

  it('When rendered / Then it shows the description', () => {
    render(<EmptyState icon={MockIcon} title="Empty" description="There is nothing here yet." />);
    expect(screen.getByText('There is nothing here yet.')).toBeInTheDocument();
  });

  it('When rendered / Then the icon is displayed', () => {
    render(<EmptyState icon={MockIcon} title="Empty" description="Nothing." />);
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
  });
});

describe('Given EmptyState with an action prop', () => {
  it('When rendered / Then the action button is visible', () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon={MockIcon}
        title="No People"
        description="Add your first person."
        action={{ label: 'Add Person', onClick: handleClick }}
      />
    );
    expect(screen.getByRole('button', { name: 'Add Person' })).toBeInTheDocument();
  });

  it('When the action button is clicked / Then the onClick callback is called', () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon={MockIcon}
        title="No People"
        description="Add your first person."
        action={{ label: 'Add Person', onClick: handleClick }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Person' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('When action is not provided / Then no button is rendered', () => {
    render(<EmptyState icon={MockIcon} title="Empty" description="Nothing here." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Given EmptyState with long description', () => {
  it('When rendered / Then the full description text is present in the DOM', () => {
    const longDesc = 'This module contains no data. Please import or create records to get started.';
    render(<EmptyState icon={MockIcon} title="No Data" description={longDesc} />);
    expect(screen.getByText(longDesc)).toBeInTheDocument();
  });
});

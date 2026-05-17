import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import PageHeader from './PageHeader';

describe('Given PageHeader with required title', () => {
  it('When rendered / Then it shows the title', () => {
    render(<PageHeader title="People Registry" />);
    expect(screen.getByText('People Registry')).toBeInTheDocument();
  });

  it('When no subtitle is provided / Then no subtitle element appears', () => {
    const { container } = render(<PageHeader title="Title Only" />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('When no actions are provided / Then the actions slot is not rendered', () => {
    const { container } = render(<PageHeader title="No Actions" />);
    // There should be no button in the rendered output
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Given PageHeader with optional subtitle', () => {
  it('When subtitle is provided / Then it is displayed below the title', () => {
    render(<PageHeader title="People" subtitle="Manage your team members" />);
    expect(screen.getByText('Manage your team members')).toBeInTheDocument();
  });
});

describe('Given PageHeader with an actions slot', () => {
  it('When an action button is provided / Then it is rendered', () => {
    const handleClick = vi.fn();
    render(
      <PageHeader
        title="People"
        actions={<button onClick={handleClick}>Add Person</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Add Person' })).toBeInTheDocument();
  });

  it('When the action button is clicked / Then the callback fires', () => {
    const handleClick = vi.fn();
    render(
      <PageHeader
        title="People"
        actions={<button onClick={handleClick}>Add</button>}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('When multiple action nodes are provided / Then all are rendered', () => {
    render(
      <PageHeader
        title="People"
        actions={
          <>
            <button>Import</button>
            <button>Export</button>
          </>
        }
      />
    );
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FieldLoading from './FieldLoading';

describe('FieldLoading', () => {
  it('Given options are loading / When rendered / Then a skeleton covers the field and the label is kept for screen readers', () => {
    render(
      <FieldLoading loading label="Loading users...">
        <input placeholder="Select user..." />
      </FieldLoading>,
    );
    expect(screen.getByTestId('field-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading users...')).toHaveClass('sr-only');
    expect(screen.getByPlaceholderText('Select user...')).toBeInTheDocument();
  });

  it('Given options have loaded / When rendered / Then only the field shows', () => {
    render(
      <FieldLoading loading={false}>
        <input placeholder="Select user..." />
      </FieldLoading>,
    );
    expect(screen.queryByTestId('field-loading')).not.toBeInTheDocument();
  });
});

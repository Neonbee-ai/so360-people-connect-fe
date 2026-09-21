import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// The tabs each have their own dedicated spec files — here they are stubbed so
// this spec exercises only the page's tab-switching shell.
vi.mock('../../components/payroll/config/SettingsTab', () => ({ default: () => <div>SettingsTab content</div> }));
vi.mock('../../components/payroll/config/GroupsPeriodsTab', () => ({ default: () => <div>GroupsPeriodsTab content</div> }));
vi.mock('../../components/payroll/config/ComponentsTab', () => ({ default: () => <div>ComponentsTab content</div> }));
vi.mock('../../components/payroll/config/StructuresTab', () => ({ default: () => <div>StructuresTab content</div> }));
vi.mock('../../components/payroll/config/BenefitsTab', () => ({ default: () => <div>BenefitsTab content</div> }));
vi.mock('../../components/payroll/config/StatutoryTab', () => ({ default: () => <div>StatutoryTab content</div> }));
vi.mock('../../components/payroll/config/PayslipTemplateTab', () => ({ default: () => <div>PayslipTemplateTab content</div> }));

import PayrollConfigurationPage from './PayrollConfigurationPage';

describe('GIVEN the payroll configuration page', () => {
  it('WHEN it loads THEN the Settings tab is active by default and all tab buttons render', () => {
    render(<PayrollConfigurationPage />);
    expect(screen.getByText('Payroll Configuration')).toBeInTheDocument();
    for (const tab of ['Settings', 'Groups & Periods', 'Components', 'Structures', 'Benefits', 'Statutory', 'Payslip Template']) {
      expect(screen.getByText(tab)).toBeInTheDocument();
    }
    expect(screen.getByText('SettingsTab content')).toBeInTheDocument();
    expect(screen.queryByText('ComponentsTab content')).not.toBeInTheDocument();
  });

  it.each([
    ['Groups & Periods', 'GroupsPeriodsTab content'],
    ['Components', 'ComponentsTab content'],
    ['Structures', 'StructuresTab content'],
    ['Benefits', 'BenefitsTab content'],
    ['Statutory', 'StatutoryTab content'],
    ['Payslip Template', 'PayslipTemplateTab content'],
  ])('WHEN the %s tab is clicked THEN only that tab content renders', (label, content) => {
    render(<PayrollConfigurationPage />);
    fireEvent.click(screen.getByText(label));
    expect(screen.getByText(content)).toBeInTheDocument();
    expect(screen.queryByText('SettingsTab content')).not.toBeInTheDocument();
  });

  it('WHEN switching back to Settings THEN the settings tab content returns', () => {
    render(<PayrollConfigurationPage />);
    fireEvent.click(screen.getByText('Benefits'));
    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('SettingsTab content')).toBeInTheDocument();
    expect(screen.queryByText('BenefitsTab content')).not.toBeInTheDocument();
  });
});

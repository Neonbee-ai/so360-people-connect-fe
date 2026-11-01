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


describe('GIVEN the Comb payroll configuration page', () => {
  it('WHEN it loads THEN the Settings tab content is shown by default', () => {
    render(<PayrollConfigurationPage />);
    expect(screen.getByText('Payroll Configuration')).toBeInTheDocument();
    expect(screen.getByText('SettingsTab content')).toBeInTheDocument();
  });

  it('WHEN another section is selected THEN only its content renders', () => {
    render(<PayrollConfigurationPage />);
    fireEvent.click(screen.getByText('Benefits'));
    expect(screen.getByText('BenefitsTab content')).toBeInTheDocument();
    expect(screen.queryByText('SettingsTab content')).not.toBeInTheDocument();
  });

  it('WHEN each section is selected in turn THEN each tab renders its own content', () => {
    render(<PayrollConfigurationPage />);
    for (const [label, content] of [['Groups & Periods', 'GroupsPeriodsTab'], ['Components', 'ComponentsTab'], ['Structures', 'StructuresTab'], ['Statutory', 'StatutoryTab'], ['Payslip Template', 'PayslipTemplateTab']]) {
      fireEvent.click(screen.getByText(label));
      expect(screen.getByText(`${content} content`)).toBeInTheDocument();
    }
  });
});

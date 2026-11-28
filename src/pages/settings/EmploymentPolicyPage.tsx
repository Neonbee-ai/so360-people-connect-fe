import React, { useState, useEffect, useRef } from 'react';

import { Button, EmptyState, Grid, NumberInput, SettingsCard, SettingsPageTemplate, Stack } from '@so360/design-system';
import { Save, RefreshCw } from 'lucide-react';
import { orgPolicyApi, EmploymentPolicy } from '../../services/orgPolicyService';
import { useShellBridge } from '@so360/shell-context';

const EmploymentPolicyPage: React.FC = () => {
  const [policy, setPolicy] = useState<EmploymentPolicy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoadCompleted, setIsLoadCompleted] = useState(false);
  const loadAttemptedRef = useRef(false);
  const shell = useShellBridge();
  const flagsLoaded = shell?.effectiveFlagsLoaded ?? false;
  const canManage = (flagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:employment_policy:manage') ?? true);
  const tenantId = shell?.currentTenant?.id;
  const orgId = shell?.currentOrg?.id;

  useEffect(() => {
    if (!tenantId || tenantId === 'default-tenant' || !orgId) return;
    loadAttemptedRef.current = true;
    const load = async () => {
      setLoadError(null);
      try {
        const data = await orgPolicyApi.getEmploymentPolicy();
        setPolicy(data);
      } catch (err: any) {
        setLoadError(err.message || 'Unable to load employment policy.');
      } finally {
        setIsLoadCompleted(true);
      }
    };
    load();
  }, [tenantId, orgId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loadAttemptedRef.current) {
        setLoadError('Unable to load organization settings. Please refresh and try again.');
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  const handleSave = async () => {
    if (!policy) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await orgPolicyApi.updateEmploymentPolicy(policy);
      setPolicy(updated);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save policy. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const pageProps = {
    title: 'Employment Policy',
    description: 'Overtime thresholds and premium multiplier — shared across Timesheet, Accounting, and Payroll.',
  };

  if (loadError) {
    return (
      <SettingsPageTemplate
        trail={[{ label: 'Settings', to: '/people/settings' }]}
        {...pageProps}
        banner={{ variant: 'warning', title: 'Unable to load employment policy', message: loadError }}
      />
    );
  }

  if (!isLoadCompleted) {
    return (
      <SettingsPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]} {...pageProps} loading />
    );
  }

  if (!policy) {
    return (
      <SettingsPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]} {...pageProps}>
        <EmptyState
          title="No employment policy configured"
          description="Contact your administrator to configure overtime thresholds."
        />
      </SettingsPageTemplate>
    );
  }

  const primaryAction = canManage ? {
    id: 'save-policy',
    label: isSaving ? 'Saving...' : 'Save policy',
    icon: <Save />,
    onSelect: handleSave,
    disabled: isSaving,
  } : undefined;

  return (
    <SettingsPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]} {...pageProps}
      description={`${pageProps.description} Changes apply to new time entries only; previously approved costs are immutable for accounting integrity.`}
      primaryAction={primaryAction}
      banner={saveError ? { variant: 'danger', message: saveError } : undefined}
    >
      <Stack gap="region">
        <Grid columns="auto" gap="lg">
          <Grid.Item span={6}>
          <Stack gap="default">
            <SettingsCard title="Daily Threshold">
              <NumberInput
                name="daily_threshold"
                label="Hours per day before overtime kicks in"
                value={policy.daily_threshold}
                suffix="hrs"
                onChange={(n) => setPolicy({ ...policy, daily_threshold: n ?? NaN })}
              />
            </SettingsCard>
            <SettingsCard title="Weekly Threshold">
              <NumberInput
                name="weekly_threshold"
                label="Hours per week before overtime kicks in"
                value={policy.weekly_threshold}
                suffix="hrs"
                onChange={(n) => setPolicy({ ...policy, weekly_threshold: n ?? NaN })}
              />
            </SettingsCard>
          </Stack>
          </Grid.Item>
          <Grid.Item span={6}>
          <Stack gap="default">
            <SettingsCard title="Overtime Multiplier">
              <NumberInput
                name="premium_multiplier"
                label="Premium rate multiplier (e.g. 1.5x, 2.0x)"
                step={0.1}
                value={policy.premium_multiplier}
                onChange={(n) => setPolicy({ ...policy, premium_multiplier: n ?? NaN })}
              />
            </SettingsCard>
          </Stack>
          </Grid.Item>
        </Grid>

        {canManage && (
          <Button
            variant="secondary"
            type="button"
            onClick={() => setPolicy({ daily_threshold: 8, weekly_threshold: 40, premium_multiplier: 1.5 })}
          >
            <RefreshCw className="w-4 h-4" />
            Reset to Defaults
          </Button>
        )}
      </Stack>
    </SettingsPageTemplate>
  );
};

export default EmploymentPolicyPage;

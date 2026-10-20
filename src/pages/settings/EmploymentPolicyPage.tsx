import React, { useState, useEffect, useRef } from 'react';

import { Banner, Button, EmptyState, Grid, NumberInput, SettingsCard, SettingsPageTemplate, Spinner, Stack } from '@so360/design-system';
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
      <SettingsPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]} {...pageProps}>
        <Banner variant="warning" title="Unable to load employment policy">{loadError}</Banner>
      </SettingsPageTemplate>
    );
  }

  if (!isLoadCompleted) {
    return (
      <SettingsPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]} {...pageProps}>
        <Spinner aria-label="Loading employment policy..." />
      </SettingsPageTemplate>
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

  const primaryAction = canManage ? (
    <Button variant="primary" onClick={handleSave} disabled={isSaving} className="gap-nb-2">
      <Save className="w-4 h-4" />
      {isSaving ? 'Saving...' : 'Save Policy'}
    </Button>
  ) : undefined;

  return (
    <SettingsPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]} {...pageProps} primaryAction={primaryAction}>
      <Stack gap="region">
        <Grid columns={2} gap="lg">
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
            <Banner variant="warning">
              Changes apply to <strong>new</strong> time entries only. Previously approved costs are immutable for accounting integrity.
            </Banner>
          </Stack>
        </Grid>

        {saveError && <Banner variant="danger">{saveError}</Banner>}

        {canManage && (
          <Button
            variant="secondary"
            className="gap-nb-2"
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

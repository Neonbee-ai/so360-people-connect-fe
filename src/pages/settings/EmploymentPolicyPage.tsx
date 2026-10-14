import React, { useState, useEffect, useRef } from 'react';

import { Button } from '@so360/design-system';
import { Settings, Save, RefreshCw, AlertCircle } from 'lucide-react';
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

  if (loadError) {
    return (
      <div className="p-6 flex items-start gap-3 text-warning">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Unable to load employment policy</p>
          <p className="text-sm text-fg-muted mt-1">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!isLoadCompleted) {
    return <div className="p-6 text-fg-muted animate-pulse">Loading employment policy...</div>;
  }

  if (!policy) {
    return (
      <div className="p-6 flex items-start gap-3 text-fg-muted">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-fg-subtle" />
        <div>
          <p className="font-medium text-fg">No employment policy configured</p>
          <p className="text-sm mt-1">Contact your administrator to configure overtime thresholds.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-fg tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Employment Policy
        </h1>
        <p className="text-fg-muted">
          Overtime thresholds and premium multiplier — shared across Timesheet, Accounting, and Payroll.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-surface/50 border border-line p-6 rounded-nb space-y-4">
            <h3 className="text-sm font-bold text-fg-subtle uppercase tracking-widest">Daily Threshold</h3>
            <div className="space-y-2">
              <label className="text-xs text-fg-muted">Hours per day before overtime kicks in</label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full bg-bg border border-line rounded-nb px-4 py-2 text-fg font-medium"
                  value={policy.daily_threshold}
                  onChange={e => setPolicy({ ...policy, daily_threshold: parseFloat(e.target.value) })}
                />
                <span className="absolute right-4 top-2 text-fg-subtle">hrs</span>
              </div>
            </div>
          </div>

          <div className="bg-surface/50 border border-line p-6 rounded-nb space-y-4">
            <h3 className="text-sm font-bold text-fg-subtle uppercase tracking-widest">Weekly Threshold</h3>
            <div className="space-y-2">
              <label className="text-xs text-fg-muted">Hours per week before overtime kicks in</label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full bg-bg border border-line rounded-nb px-4 py-2 text-fg font-medium"
                  value={policy.weekly_threshold}
                  onChange={e => setPolicy({ ...policy, weekly_threshold: parseFloat(e.target.value) })}
                />
                <span className="absolute right-4 top-2 text-fg-subtle">hrs</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface/50 border border-line p-6 rounded-nb space-y-4">
            <h3 className="text-sm font-bold text-fg-subtle uppercase tracking-widest">Overtime Multiplier</h3>
            <div className="space-y-2">
              <label className="text-xs text-fg-muted">Premium rate multiplier (e.g. 1.5x, 2.0x)</label>
              <input
                type="number"
                step="0.1"
                className="w-full bg-bg border border-line rounded-nb px-4 py-2 text-success font-bold"
                value={policy.premium_multiplier}
                onChange={e => setPolicy({ ...policy, premium_multiplier: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div className="p-4 bg-warning/5 border border-warning/10 rounded-nb flex gap-3 italic">
            <AlertCircle className="w-5 h-5 text-warning shrink-0" />
            <p className="text-xs text-fg-muted leading-relaxed">
              Changes apply to <strong>new</strong> time entries only. Previously approved costs are immutable for accounting integrity.
            </p>
          </div>
        </div>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {canManage && (
        <div className="flex justify-end gap-3 pt-6 border-t border-line">
          <Button
            variant="secondary"
            className="gap-2"
            type="button"
            onClick={() => setPolicy({ daily_threshold: 8, weekly_threshold: 40, premium_multiplier: 1.5 })}
          >
            <RefreshCw className="w-4 h-4" />
            Reset to Defaults
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving} className="gap-2 min-w-[140px]">
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Policy'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EmploymentPolicyPage;

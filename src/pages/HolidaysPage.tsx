import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { CalendarDays, Edit2, Trash2 } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { toast, useConfirm, Select, Button, IconButton, Badge, ListPageTemplate, DataTable, Modal, TextField, DateInput, Switch, Stack, Cluster } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import {
  holidaysApi,
  Holiday,
  CreateHolidayPayload,
  HolidayType,
  CopyHolidaysResult,
} from '../services/holidaysService';
import { workLocationsApi, WorkLocation } from '../services/workLocationsService';
import { mastersApi, MasterRow } from '../services/mastersService';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const HOLIDAY_TYPE_OPTIONS: Array<{ value: HolidayType; label: string }> = [
  { value: 'national', label: 'National' },
  { value: 'company', label: 'Company' },
  { value: 'regional', label: 'Regional' },
  { value: 'optional', label: 'Optional' },
  { value: 'custom', label: 'Custom' },
];

const HOLIDAY_TYPE_TONE: Record<HolidayType, 'primary' | 'info' | 'neutral' | 'warning'> = {
  national: 'primary',
  company: 'info',
  regional: 'neutral',
  optional: 'warning',
  custom: 'neutral',
};

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

const groupByMonth = (holidays: Holiday[]): Array<{ month: string; items: Holiday[] }> => {
  const groups = new Map<number, Holiday[]>();
  holidays.forEach(h => {
    const monthIdx = new Date(h.holiday_date).getMonth();
    const list = groups.get(monthIdx) ?? [];
    list.push(h);
    groups.set(monthIdx, list);
  });
  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([monthIdx, items]) => ({
      month: MONTH_NAMES[monthIdx],
      items: [...items].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)),
    }));
};

const HolidaysPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:holidays:create') ?? true);

  const [year, setYear] = useState<string>(String(currentYear));
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [copying, setCopying] = useState(false);

  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<MasterRow[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await holidaysApi.getAll({
        year,
        holiday_type: typeFilter || undefined,
      });
      setHolidays(result.data);
    } catch {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, [year, typeFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    workLocationsApi.getAll().then(r => setWorkLocations(r.data ?? [])).catch(() => setWorkLocations([]));
    mastersApi.getAll('employment_type').then(r => setEmploymentTypes(r.data ?? [])).catch(() => setEmploymentTypes([]));
  }, []);

  const workLocationName = useCallback(
    (id?: string | null) => workLocations.find(l => l.id === id)?.name,
    [workLocations],
  );
  const employmentTypeName = useCallback(
    (id?: string | null) => employmentTypes.find(m => m.id === id)?.name,
    [employmentTypes],
  );

  const monthGroups = useMemo(() => groupByMonth(holidays), [holidays]);

  const handleCreate = async (data: CreateHolidayPayload) => {
    try {
      await holidaysApi.create(data);
      setShowModal(false);
      toast.success(`Holiday "${data.name}" created`);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create holiday');
    }
  };

  const handleUpdate = async (id: string, data: Partial<CreateHolidayPayload>) => {
    try {
      await holidaysApi.update(id, data);
      setEditing(null);
      toast.success('Holiday updated');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update holiday');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await holidaysApi.delete(id);
      toast.success(result.message);
      load();
    } catch {
      toast.error('Failed to delete holiday');
    }
  };

  const [confirm, confirmDialog] = useConfirm();

  const handleCopyPreviousYear = async () => {
    const toYear = Number(year);
    const fromYear = toYear - 1;
    if (!(await confirm({ title: 'Copy holidays', message: `Copy every holiday from ${fromYear} into ${toYear}?`, confirmLabel: 'Copy' }))) return;
    try {
      setCopying(true);
      const result: CopyHolidaysResult = await holidaysApi.copyPreviousYear(fromYear, toYear);
      if (result.created > 0 && result.skipped > 0) {
        toast.success(`Copied ${result.created} holiday(s), skipped ${result.skipped} duplicate(s)`);
      } else if (result.created > 0) {
        toast.success(`Copied ${result.created} holiday(s) from ${fromYear}`);
      } else {
        toast.error(`Nothing to copy — all ${result.skipped} holiday(s) from ${fromYear} already exist in ${toYear}`);
      }
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to copy holidays');
    } finally {
      setCopying(false);
    }
  };

  const columns: DataTableColumn<Holiday>[] = [
    { key: 'holiday_date', header: 'Date', render: h => <span className="text-fg">{h.holiday_date}</span> },
    { key: 'name', header: 'Name', render: h => <span className="font-medium text-fg">{h.name}</span> },
    {
      key: 'location',
      header: 'Location',
      render: h => <span className="text-fg-muted">{[h.region, h.state, h.country].filter(Boolean).join(', ') || '—'}</span>,
    },
    {
      key: 'holiday_type',
      header: 'Type',
      render: h => (
        <Badge tone={HOLIDAY_TYPE_TONE[h.holiday_type] || 'neutral'}>
          {HOLIDAY_TYPE_OPTIONS.find(t => t.value === h.holiday_type)?.label || h.holiday_type}
        </Badge>
      ),
    },
    {
      key: 'scope',
      header: 'Scope',
      render: h => (
        <span className="text-nb-caption text-fg-muted">
          {[
            h.work_location_id ? workLocationName(h.work_location_id) : null,
            h.employment_type_master_id ? employmentTypeName(h.employment_type_master_id) : null,
          ].filter(Boolean).join(' · ') || 'Org-wide'}
        </span>
      ),
    },
    ...(canManage
      ? [{
          key: 'actions',
          header: 'Actions',
          render: (h: Holiday) => (
            <Cluster gap="tight" align="center">
              <IconButton label="Edit" icon={<Edit2 size={14} />} variant="ghost" size="sm" onClick={() => setEditing(h)} />
              <IconButton label="Delete" icon={<Trash2 size={14} />} variant="ghost" size="sm" onClick={() => handleDelete(h.id)} />
            </Cluster>
          ),
        } as DataTableColumn<Holiday>]
      : []),
  ];

  return (
    <>
      {confirmDialog}
      <ListPageTemplate trail={[]}
        title="Holiday Calendar"
        description="Manage the organization's holiday list by year"
        loading={loading}
        isEmpty={holidays.length === 0}
        primaryAction={canManage ? <Button onClick={() => setShowModal(true)}>Add Holiday</Button> : undefined}
        toolbarEnd={
          <Cluster gap="tight" align="center">
            <Select name="holidays-select-44" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} options={[{ value: '', label: 'All Types' }, ...HOLIDAY_TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label }))]} />
            <Select name="holidays-select-45" value={year} onChange={e => setYear(e.target.value)} options={[...YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) }))]} />
            {canManage && (
              <Button
                variant="secondary"
                onClick={handleCopyPreviousYear}
                disabled={copying}
                title={`Copy every holiday from ${Number(year) - 1} into ${year}`}
              >
                {copying ? 'Copying…' : 'Copy from Previous Year'}
              </Button>
            )}
          </Cluster>
        }
        empty={
          <EmptyState
            icon={CalendarDays}
            title="No holidays"
            description={`No holidays configured for ${year}. Add public and optional holidays for your organization.`}
            action={canManage ? { label: 'Add Holiday', onClick: () => setShowModal(true) } : undefined}
          />
        }
      >
        <Stack gap="region">
          {monthGroups.map(group => (
            <Stack key={group.month} gap="tight">
              <h3 className="text-nb-section font-semibold text-fg-muted">{group.month}</h3>
              <DataTable name={`holidays-${group.month.toLowerCase()}`} columns={columns} rows={group.items} rowKey={h => h.id} />
            </Stack>
          ))}
        </Stack>
      </ListPageTemplate>

      <HolidayModal
        isOpen={showModal || !!editing}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        holiday={editing}
        workLocations={workLocations}
        employmentTypes={employmentTypes}
      />
    </>
  );
};

// =============================================================================
// Holiday Modal
// =============================================================================

interface HolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateHolidayPayload) => void;
  onUpdate: (id: string, data: Partial<CreateHolidayPayload>) => void;
  holiday: Holiday | null;
  workLocations: WorkLocation[];
  employmentTypes: MasterRow[];
}

const BLANK: CreateHolidayPayload = {
  name: '', holiday_date: '', holiday_type: 'national', state: '', country: '', region: '',
  is_optional: false, is_mandatory: true, work_location_id: '', employment_type_master_id: '',
};

const HolidayModal: React.FC<HolidayModalProps> = ({
  isOpen, onClose, onCreate, onUpdate, holiday, workLocations, employmentTypes,
}) => {
  const [form, setForm] = useState<CreateHolidayPayload>(BLANK);

  useEffect(() => {
    if (holiday) {
      setForm({
        name: holiday.name,
        holiday_date: holiday.holiday_date,
        holiday_type: holiday.holiday_type || 'national',
        state: holiday.state || '',
        country: holiday.country || '',
        region: holiday.region || '',
        is_optional: holiday.is_optional,
        is_mandatory: holiday.is_mandatory,
        work_location_id: holiday.work_location_id || '',
        employment_type_master_id: holiday.employment_type_master_id || '',
      });
    } else {
      setForm(BLANK);
    }
  }, [holiday]);

  const set = (field: keyof CreateHolidayPayload, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.holiday_date) return;
    const payload: CreateHolidayPayload = {
      ...form,
      work_location_id: form.work_location_id || null,
      employment_type_master_id: form.employment_type_master_id || null,
    };
    if (holiday) {
      onUpdate(holiday.id, payload);
    } else {
      onCreate(payload);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={holiday ? 'Edit Holiday' : 'Add Holiday'}
      size="sm"
      footer={
        <Cluster gap="tight" justify="end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="holiday-form">{holiday ? 'Save Changes' : 'Add Holiday'}</Button>
        </Cluster>
      }
    >
      <form id="holiday-form" onSubmit={handleSubmit}>
        <Stack gap="default">
          <TextField
            name="holiday-name"
            label="Name *"
            required
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)}
            placeholder="e.g. Republic Day"
          />
          <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
            <DateInput name="holiday-date" label="Date *" required value={form.holiday_date} onChange={(v: string) => set('holiday_date', v)} />
            <Select name="holidays-select-46" label="Type *" value={form.holiday_type} onChange={e => set('holiday_type', e.target.value as HolidayType)} options={[...HOLIDAY_TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label }))]} />
          </div>
          <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
            <Select name="holidays-select-47" label="Work Location" value={form.work_location_id || ''} onChange={e => set('work_location_id', e.target.value)} options={[{ value: '', label: 'All Locations' }, ...workLocations.map((l) => ({ value: l.id, label: l.name }))]} />
            <Select name="holidays-select-48" label="Employment Type" value={form.employment_type_master_id || ''} onChange={e => set('employment_type_master_id', e.target.value)} options={[{ value: '', label: 'All Employment Types' }, ...employmentTypes.map((m) => ({ value: m.id, label: m.name }))]} />
          </div>
          <div className="grid grid-cols-1 wc-medium:grid-cols-3 gap-nb-3">
            <TextField name="holiday-region" label="Region" value={form.region} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('region', e.target.value)} />
            <TextField name="holiday-state" label="State" value={form.state} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('state', e.target.value)} />
            <TextField name="holiday-country" label="Country" value={form.country} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('country', e.target.value)} />
          </div>
          <Switch name="holiday-is-optional" label="Optional holiday" checked={!!form.is_optional} onCheckedChange={(v: boolean) => set('is_optional', v)} />
        </Stack>
      </form>
    </Modal>
  );
};

export default HolidaysPage;

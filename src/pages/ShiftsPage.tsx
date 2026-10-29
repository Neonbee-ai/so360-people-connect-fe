import React, { useEffect, useState, useCallback } from 'react';
import { Clock, Plus, Edit2, Trash2 } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import {
  toast, Drawer, DataTable, type DataTableColumn,
  Badge, Button, Cluster, IconButton, ListPageTemplate, Stack, Switch, TextField, NumberInput, FieldGrid,
} from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { shiftsApi, Shift, CreateShiftPayload } from '../services/shiftsService';

const ShiftsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:shifts:create') ?? true);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await shiftsApi.getAll();
      setShifts(result.data);
    } catch {
      toast.error('Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: CreateShiftPayload) => {
    try {
      await shiftsApi.create(data);
      setShowModal(false);
      toast.success(`Shift "${data.name}" created`);
      load();
    } catch {
      toast.error('Failed to create shift');
    }
  };

  const handleUpdate = async (id: string, data: Partial<CreateShiftPayload>) => {
    try {
      await shiftsApi.update(id, data);
      setEditing(null);
      toast.success('Shift updated');
      load();
    } catch {
      toast.error('Failed to update shift');
    }
  };

  const handleToggleActive = async (shift: Shift) => {
    await handleUpdate(shift.id, { is_active: !shift.is_active });
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await shiftsApi.delete(id);
      toast.success(result.message);
      load();
    } catch {
      toast.error('Failed to delete shift');
    }
  };

  const columns: DataTableColumn<Shift>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (shift) => (
        <Cluster gap="tight">
          <span className="font-medium text-fg">{shift.name}</span>
          {shift.is_night_shift && <Badge tone="primary">Night</Badge>}
        </Cluster>
      ),
    },
    { key: 'timing', header: 'Timing', render: (shift) => <span className="text-fg">{shift.start_time} – {shift.end_time}</span> },
    { key: 'grace', header: 'Grace', render: (shift) => <span className="text-fg-muted">{shift.grace_period_minutes} min</span> },
    { key: 'break', header: 'Break', render: (shift) => <span className="text-fg-muted">{shift.break_duration_minutes} min</span> },
    {
      key: 'is_active',
      header: 'Active',
      interactive: true,
      render: (shift) =>
        canManage ? (
          <Switch
            name={`shift-active-${shift.id}`}
            checked={shift.is_active}
            onCheckedChange={() => handleToggleActive(shift)}
            label={shift.is_active ? 'Deactivate' : 'Activate'}
            hideLabel
          />
        ) : (
          <Badge tone={shift.is_active ? 'success' : 'neutral'}>{shift.is_active ? 'Active' : 'Inactive'}</Badge>
        ),
    },
    ...(canManage
      ? [{
          key: 'actions',
          header: 'Actions',
          interactive: true,
          render: (shift: Shift) => (
            <Cluster gap="tight">
              <IconButton label="Edit" icon={<Edit2 size={14} />} onClick={() => setEditing(shift)} />
              <IconButton label="Delete" variant="danger" icon={<Trash2 size={14} />} onClick={() => handleDelete(shift.id)} />
            </Cluster>
          ),
        } as DataTableColumn<Shift>]
      : []),
  ];

  return (
    <>
      <ListPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]}
        title="Shift Management"
        description="Define work shifts, grace periods, and weekly offs"
        primaryAction={
          canManage ? (
            <Button onClick={() => setShowModal(true)}>
              <Plus size={16} />
              Add Shift
            </Button>
          ) : undefined
        }
        loading={loading}
        isEmpty={shifts.length === 0}
        empty={
          <EmptyState
            icon={Clock}
            title="No shifts"
            description="Add shifts like Morning, Evening, or Night with grace periods and break durations."
            action={canManage ? { label: 'Add Shift', onClick: () => setShowModal(true) } : undefined}
          />
        }
      >
        <DataTable columns={columns} rows={shifts} rowKey={(s) => s.id} />
      </ListPageTemplate>

      <ShiftModal
        isOpen={showModal || !!editing}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        shift={editing}
      />
    </>
  );
};

// =============================================================================
// Shift Modal
// =============================================================================

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateShiftPayload) => void;
  onUpdate: (id: string, data: Partial<CreateShiftPayload>) => void;
  shift: Shift | null;
}

const BLANK: CreateShiftPayload = {
  name: '', start_time: '09:00', end_time: '18:00', grace_period_minutes: 0, break_duration_minutes: 0, is_night_shift: false, is_active: true,
};

const ShiftModal: React.FC<ShiftModalProps> = ({ isOpen, onClose, onCreate, onUpdate, shift }) => {
  const [form, setForm] = useState<CreateShiftPayload>(BLANK);

  useEffect(() => {
    if (shift) {
      setForm({
        name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        grace_period_minutes: shift.grace_period_minutes,
        break_duration_minutes: shift.break_duration_minutes,
        is_night_shift: shift.is_night_shift,
        is_active: shift.is_active,
      });
    } else {
      setForm(BLANK);
    }
  }, [shift]);

  const set = (field: keyof CreateShiftPayload, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.start_time || !form.end_time) return;
    if (shift) {
      onUpdate(shift.id, form);
    } else {
      onCreate(form);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={shift ? 'Edit Shift' : 'Add Shift'}
      size="sm"
      footer={
        <Cluster justify="end" gap="tight">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="shift-form">
            {shift ? 'Save Changes' : 'Add Shift'}
          </Button>
        </Cluster>
      }
    >
      <form id="shift-form" onSubmit={handleSubmit}>
        <Stack gap="default">
          <TextField
            name="shift-name"
            id="shift-name"
            maxLength={100}
            label="Name *"
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Morning Shift"
          />
          <FieldGrid>
            <TextField
              name="shift-start-time"
              id="shift-start-time"
              label="Start Time *"
              type="time"
              required
              value={form.start_time}
              onChange={e => set('start_time', e.target.value)}
            />
            <TextField
              name="shift-end-time"
              id="shift-end-time"
              label="End Time *"
              type="time"
              required
              value={form.end_time}
              onChange={e => set('end_time', e.target.value)}
            />
          </FieldGrid>
          <FieldGrid>
            <NumberInput
              name="shift-grace"
              label="Grace Period (min)"
              min={0}
              value={form.grace_period_minutes}
              onChange={(v: number | null) => set('grace_period_minutes', v ?? 0)}
            />
            <NumberInput
              name="shift-break"
              label="Break Duration (min)"
              min={0}
              value={form.break_duration_minutes}
              onChange={(v: number | null) => set('break_duration_minutes', v ?? 0)}
            />
          </FieldGrid>
          <Switch
            name="shift-night"
            label="Night shift"
            checked={!!form.is_night_shift}
            onCheckedChange={(v: boolean) => set('is_night_shift', v)}
          />
          {shift && (
            <Switch
              name="shift-form-active"
              label="Active"
              checked={!!form.is_active}
              onCheckedChange={(v: boolean) => set('is_active', v)}
            />
          )}
        </Stack>
      </form>
    </Drawer>
  );
};

export default ShiftsPage;

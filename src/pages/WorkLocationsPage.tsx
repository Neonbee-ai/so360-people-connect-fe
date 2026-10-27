import React, { useEffect, useState, useCallback } from 'react';
import { MapPin, Plus, Edit2, Trash2 } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import {
  toast, Drawer, DataTable, DeleteConfirmDialog, type DataTableColumn, Select,
  Badge, Button, Cluster, IconButton, ListPageTemplate, Stack, Switch, TextField,
} from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { workLocationsApi, WorkLocation, CreateWorkLocationPayload, LocationType } from '../services/workLocationsService';

const LOCATION_TYPE_STYLES: Record<LocationType, { label: string; tone: 'warning' | 'primary' | 'neutral' | 'success' }> = {
  factory: { label: 'Factory', tone: 'warning' },
  store: { label: 'Store', tone: 'primary' },
  office: { label: 'Office', tone: 'neutral' },
  remote: { label: 'Remote', tone: 'success' },
};

const LocationTypeBadge: React.FC<{ type: LocationType }> = ({ type }) => {
  const style = LOCATION_TYPE_STYLES[type] || LOCATION_TYPE_STYLES.office;
  return <Badge tone={style.tone}>{style.label}</Badge>;
};

const WorkLocationsPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:employees:create') ?? true);

  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState<WorkLocation | null>(null);
  // Delete is destructive (or silently deactivates when people are assigned) —
  // never fire it straight off a single icon click.
  const [confirmDelete, setConfirmDelete] = useState<WorkLocation | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Management view: inactive locations must stay visible, otherwise
      // deactivating one removes the only way to edit or reactivate it.
      const result = await workLocationsApi.getAll(true);
      setLocations(result.data);
    } catch {
      toast.error('Failed to load work locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: CreateWorkLocationPayload) => {
    try {
      await workLocationsApi.create(data);
      setShowDrawer(false);
      toast.success(`Work location "${data.name}" created`);
      load();
    } catch (err) {
      // Surface the server's reason — a duplicate-name rejection is only
      // actionable if the admin can read it.
      toast.error((err as Error)?.message || 'Failed to create work location');
    }
  };

  const handleUpdate = async (id: string, data: Partial<CreateWorkLocationPayload>) => {
    try {
      await workLocationsApi.update(id, data);
      setEditing(null);
      toast.success('Work location updated');
      load();
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to update work location');
    }
  };

  const handleToggleActive = async (loc: WorkLocation) => {
    await handleUpdate(loc.id, { is_active: !loc.is_active });
  };

  const handleDeleteConfirmed = async (loc: WorkLocation) => {
    setDeleteBusy(true);
    try {
      const result = await workLocationsApi.delete(loc.id);
      toast.success(result.message);
      load();
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to delete work location');
    } finally {
      setDeleteBusy(false);
      setConfirmDelete(null);
    }
  };

  const columns: DataTableColumn<WorkLocation>[] = [
    {
      key: 'name',
      header: 'Name',
      render: loc => <span className="font-medium text-fg">{loc.name}</span>,
    },
    {
      key: 'location_type',
      header: 'Type',
      render: loc => <LocationTypeBadge type={loc.location_type} />,
    },
    {
      key: 'address',
      header: 'Address',
      render: loc => <span className="text-fg-muted">{loc.address || '—'}</span>,
    },
    {
      key: 'is_active',
      header: 'Active',
      interactive: true,
      render: loc => canManage ? (
        <Switch
          name={`wl-active-${loc.id}`}
          label={loc.is_active ? 'Deactivate' : 'Activate'}
          hideLabel
          checked={loc.is_active}
          onCheckedChange={() => handleToggleActive(loc)}
        />
      ) : (
        <Badge tone={loc.is_active ? 'primary' : 'neutral'}>{loc.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    ...(canManage ? [{
      key: 'actions',
      header: 'Actions',
      interactive: true,
      render: (loc: WorkLocation) => (
        <Cluster gap="tight">
          <IconButton label="Edit" icon={<Edit2 size={14} />} size="sm" onClick={() => setEditing(loc)} />
          <IconButton label="Delete" icon={<Trash2 size={14} />} size="sm" variant="danger" onClick={() => setConfirmDelete(loc)} />
        </Cluster>
      ),
    }] : []),
  ];

  return (
    <>
      <ListPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]}
        title="Work Locations"
        description="Define where your people work"
        primaryAction={
          canManage ? (
            <Button onClick={() => setShowDrawer(true)}>
              <Plus size={16} />
              Add Location
            </Button>
          ) : undefined
        }
        loading={loading}
        isEmpty={locations.length === 0}
        empty={
          <EmptyState
            icon={MapPin}
            title="No work locations"
            description="Add locations like Factory, Store, Office, or Remote to assign to employees."
            action={canManage ? { label: 'Add Location', onClick: () => setShowDrawer(true) } : undefined}
          />
        }
      >
        <DataTable columns={columns} rows={locations} rowKey={loc => loc.id} />
      </ListPageTemplate>

      <WorkLocationDrawer
        isOpen={showDrawer || !!editing}
        onClose={() => { setShowDrawer(false); setEditing(null); }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        location={editing}
      />

      <DeleteConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDeleteConfirmed(confirmDelete)}
        title="Delete Work Location"
        message={confirmDelete ? `Delete "${confirmDelete.name}"? This cannot be undone. If employees are assigned to it, it will be deactivated instead so their records stay intact.` : ''}
        confirmText="Delete Location"
        isLoading={deleteBusy}
      />
    </>
  );
};

// =============================================================================
// Work Location Drawer — create / edit form
// =============================================================================

interface WorkLocationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateWorkLocationPayload) => void;
  onUpdate: (id: string, data: Partial<CreateWorkLocationPayload>) => void;
  location: WorkLocation | null;
}

const BLANK: CreateWorkLocationPayload = { name: '', location_type: 'office', address: '', is_active: true };

const WorkLocationDrawer: React.FC<WorkLocationDrawerProps> = ({ isOpen, onClose, onCreate, onUpdate, location }) => {
  const [form, setForm] = useState<CreateWorkLocationPayload>(BLANK);

  useEffect(() => {
    if (location) {
      setForm({ name: location.name, location_type: location.location_type, address: location.address || '', is_active: location.is_active });
    } else {
      setForm(BLANK);
    }
  }, [location, isOpen]);

  const set = (field: keyof CreateWorkLocationPayload, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (location) {
      onUpdate(location.id, form);
    } else {
      onCreate(form);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={location ? 'Edit Work Location' : 'Add Work Location'}
      size="sm"
      footer={
        <Cluster justify="end" gap="tight">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="work-location-form">
            {location ? 'Save Changes' : 'Add Location'}
          </Button>
        </Cluster>
      }
    >
      <form id="work-location-form" onSubmit={handleSubmit}>
        <Stack gap="default">
          <TextField
            name="wl-name"
            id="wl-name"
            label="Name *"
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Main Factory, Head Office"
          />
          <Select
            name="worklocations-select-84"
            label="Type *"
            value={form.location_type}
            onChange={e => set('location_type', e.target.value as LocationType)}
            options={[{ value: "factory", label: "Factory" }, { value: "store", label: "Store" }, { value: "office", label: "Office" }, { value: "remote", label: "Remote" }]}
          />
          <TextField
            name="wl-address"
            id="wl-address"
            label="Address"
            value={form.address}
            onChange={e => set('address', e.target.value)}
            placeholder="Optional address"
          />
          {location && (
            <Switch
              name="wl-form-active"
              label="Active"
              checked={!!form.is_active}
              onCheckedChange={checked => set('is_active', checked)}
            />
          )}
        </Stack>
      </form>
    </Drawer>
  );
};

export default WorkLocationsPage;

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Settings, LucideIcon } from 'lucide-react';
import EmptyState from './EmptyState';
import Modal from './Modal';
import {
  toast,
  Badge,
  Button,
  Cluster,
  DataTable,
  FieldGrid,
  IconButton,
  ListPageTemplate,
  Stack,
  Switch,
  TextField,
  type DataTableColumn,
} from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import {
  mastersApi,
  MasterRow,
  MasterType,
  CreateMasterPayload,
} from '../services/mastersService';

// Generic CRUD list page shared by all five People Connect master-data
// screens (Designations, Employment Types, Skills, Employee Status,
// Document Types). Each screen is a thin wrapper passing masterType + label
// (+ optional level/grade columns for Designations) instead of duplicating
// this page five times.

export interface MasterListPageProps {
  masterType: MasterType;
  label: string;
  pluralLabel?: string;
  icon?: LucideIcon;
  description?: string;
  /** Designations use Level + Grade; other lists omit them. */
  showLevelGrade?: boolean;
  /** Feature flag gating create/edit/delete — defaults to the shared people action flag. */
  manageFlagKey?: string;
  /**
   * Extra per-row control, rendered alongside Edit/Delete. Employment Types use
   * it to configure the leave types their employees receive by default; every
   * other master list omits it, so this stays a shared component rather than
   * growing a `masterType === 'employment_type'` branch.
   */
  rowExtraAction?: (row: MasterRow) => React.ReactNode;
}

const BLANK: CreateMasterPayload = { name: '', level: '', grade: '', is_active: true };

const MasterListPage: React.FC<MasterListPageProps> = ({
  masterType,
  label,
  pluralLabel,
  icon,
  description,
  showLevelGrade = false,
  manageFlagKey = 'action:people:employees:create',
  rowExtraAction,
}) => {
  const shell = useShellBridge();
  const canManage = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.(manageFlagKey) ?? true);
  const plural = pluralLabel || `${label}s`;
  const Icon = icon || Settings;

  const [rows, setRows] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MasterRow | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const result = await mastersApi.getAll(masterType, { includeInactive: true });
      setRows(result.data ?? []);
    } catch {
      setLoadError(true);
      toast.error(`Failed to load ${plural.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [masterType, plural]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: CreateMasterPayload) => {
    try {
      await mastersApi.create(masterType, data);
      setShowModal(false);
      toast.success(`${label} "${data.name}" created`);
      load();
    } catch {
      toast.error(`Failed to create ${label.toLowerCase()}`);
    }
  };

  const handleUpdate = async (id: string, data: Partial<CreateMasterPayload>) => {
    try {
      await mastersApi.update(masterType, id, data);
      setEditing(null);
      toast.success(`${label} updated`);
      load();
    } catch {
      toast.error(`Failed to update ${label.toLowerCase()}`);
    }
  };

  const handleToggleActive = async (row: MasterRow) => {
    await handleUpdate(row.id, { is_active: !row.is_active });
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await mastersApi.delete(masterType, id);
      toast.success(result.message);
      load();
    } catch {
      toast.error(`Failed to delete ${label.toLowerCase()}`);
    }
  };

  const columns: DataTableColumn<MasterRow>[] = [
    { key: 'name', header: 'Name', render: row => <span className="font-medium text-fg">{row.name}</span> },
    ...(showLevelGrade
      ? [
          { key: 'level', header: 'Level', render: (row: MasterRow) => row.level || '—' },
          { key: 'grade', header: 'Grade', render: (row: MasterRow) => row.grade || '—' },
        ]
      : []),
    {
      key: 'is_active',
      header: 'Active',
      interactive: true,
      render: row =>
        canManage ? (
          <Switch
            name={`active-${row.id}`}
            label={row.is_active ? 'Deactivate' : 'Activate'}
            hideLabel
            checked={!!row.is_active}
            onCheckedChange={() => handleToggleActive(row)}
          />
        ) : (
          <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
        ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: 'Actions',
            interactive: true,
            render: (row: MasterRow) => (
              <Cluster>
                {rowExtraAction?.(row)}
                <IconButton label="Edit" icon={<Edit2 size={14} />} onClick={() => setEditing(row)} />
                <IconButton label="Delete" variant="danger" icon={<Trash2 size={14} />} onClick={() => handleDelete(row.id)} />
              </Cluster>
            ),
          },
        ]
      : []),
  ];

  const emptyNode = loadError ? (
    <EmptyState
      icon={Icon}
      title={`Couldn't load ${plural.toLowerCase()}`}
      description="Something went wrong fetching this list. Try refreshing the page."
    />
  ) : (
    <EmptyState
      icon={Icon}
      title={`No ${plural.toLowerCase()}`}
      description={`Add your first ${label.toLowerCase()} to get started.`}
      action={canManage ? { label: `Add ${label}`, onClick: () => setShowModal(true) } : undefined}
    />
  );

  return (
    <>
      <ListPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]}
        title={plural}
        description={description || `Manage the ${plural.toLowerCase()} available across People Connect`}
        primaryAction={
          canManage ? (
            <Button onClick={() => setShowModal(true)}>
              <Plus size={16} />
              Add {label}
            </Button>
          ) : undefined
        }
        loading={loading}
        isEmpty={loadError || rows.length === 0}
        empty={emptyNode}
      >
        <DataTable columns={columns} rows={rows} rowKey={row => row.id} />
      </ListPageTemplate>

      <MasterFormModal
        isOpen={showModal || !!editing}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        row={editing}
        label={label}
        showLevelGrade={showLevelGrade}
      />
    </>
  );
};

// =============================================================================
// Master Form Modal — shared add/edit form for every master-data list
// =============================================================================

interface MasterFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateMasterPayload) => void;
  onUpdate: (id: string, data: Partial<CreateMasterPayload>) => void;
  row: MasterRow | null;
  label: string;
  showLevelGrade: boolean;
}

const MasterFormModal: React.FC<MasterFormModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  onUpdate,
  row,
  label,
  showLevelGrade,
}) => {
  const [form, setForm] = useState<CreateMasterPayload>(BLANK);

  useEffect(() => {
    if (row) {
      setForm({ name: row.name, level: row.level || '', grade: row.grade || '', is_active: row.is_active });
    } else {
      setForm(BLANK);
    }
  }, [row]);

  const set = (field: keyof CreateMasterPayload, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (row) {
      onUpdate(row.id, form);
    } else {
      onCreate(form);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={row ? `Edit ${label}` : `Add ${label}`}
      size="sm"
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextField
            name="master-name"
            maxLength={100}
            label="Name"
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder={`e.g. ${label}`}
          />
          {showLevelGrade && (
            <FieldGrid>
              <TextField
                name="master-level"
                label="Level"
                value={form.level || ''}
                onChange={e => set('level', e.target.value)}
                placeholder="e.g. Mid"
              />
              <TextField
                name="master-grade"
                label="Grade"
                value={form.grade || ''}
                onChange={e => set('grade', e.target.value)}
                placeholder="e.g. L3"
              />
            </FieldGrid>
          )}
          {row && (
            <Switch
              name="master-active"
              label="Active"
              checked={!!form.is_active}
              onCheckedChange={checked => set('is_active', checked)}
            />
          )}
          <Cluster justify="end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{row ? 'Save Changes' : `Add ${label}`}</Button>
          </Cluster>
        </Stack>
      </form>
    </Modal>
  );
};

export default MasterListPage;

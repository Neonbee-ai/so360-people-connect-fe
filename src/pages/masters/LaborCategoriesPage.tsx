import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, UserCog } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import {
  Alert,
  Badge,
  Button,
  Cluster,
  DataTable,
  FieldGrid,
  IconButton,
  ListPageTemplate,
  NumberInput,
  Stack,
  Switch,
  TextField,
  toast,
  getErrorMessage,
  type DataTableColumn,
} from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import {
  laborCategoriesApi,
  LaborCategory,
  CreateLaborCategoryPayload,
} from '../../services/laborCategoriesService';

/**
 * Labor Categories master data.
 *
 * Not built on MasterListPage: that component is hard-wired to the generic
 * /masters/:type API and its name/level/grade shape, whereas labor categories
 * carry a code, an hourly rate and an overtime multiplier and live behind their
 * own endpoint. It reuses the same PageHeader / EmptyState / Modal primitives so
 * the two read identically.
 *
 * A base_hourly_rate of 0 is legal but means UNCONFIGURED — a category with no
 * rate cannot cost an employee who also has no rate, which is what the Log Time
 * precheck reports as LABOR_CATEGORY_RATE_NOT_CONFIGURED. The list says so
 * explicitly instead of rendering a convincing "0.00".
 */

const BLANK: CreateLaborCategoryPayload = {
  name: '',
  code: '',
  description: '',
  base_hourly_rate: 0,
  overtime_multiplier: 1.5,
  is_active: true,
};

const LaborCategoriesPage: React.FC = () => {
  const shell = useShellBridge();
  const canManage =
    shell?.effectiveFlagsLoaded !== false &&
    (shell?.isFeatureEnabled?.('action:people:labor_categories:create') ?? true);

  const [rows, setRows] = useState<LaborCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LaborCategory | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      setRows((await laborCategoriesApi.getAll()) ?? []);
    } catch {
      setLoadError(true);
      toast.error('Failed to load labor categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (data: CreateLaborCategoryPayload) => {
    try {
      await laborCategoriesApi.create(data);
      setShowModal(false);
      toast.success(`Labor category "${data.name}" created`);
      load();
    } catch (error) {
      // Surface the backend's own message — the duplicate-code guard names the
      // offending code, which a generic string would throw away.
      toast.error(getErrorMessage(error, 'Failed to create labor category'));
    }
  };

  const handleUpdate = async (
    id: string,
    data: Partial<CreateLaborCategoryPayload>,
  ) => {
    try {
      await laborCategoriesApi.update(id, data);
      setEditing(null);
      toast.success('Labor category updated');
      load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update labor category'));
    }
  };

  const handleDelete = async (row: LaborCategory) => {
    try {
      await laborCategoriesApi.remove(row.id);
      toast.success(`Labor category "${row.name}" deleted`);
      load();
    } catch (error) {
      // The backend refuses when time entries or employee defaults reference the
      // category and explains how many — pass that through verbatim.
      toast.error(getErrorMessage(error, 'Failed to delete labor category'));
    }
  };

  const unpricedCount = rows.filter(
    (r) => r.is_active && !(Number(r.base_hourly_rate) > 0),
  ).length;

  const columns: DataTableColumn<LaborCategory>[] = [
    { key: 'name', header: 'Name', render: (row) => <span className="font-medium text-fg">{row.name}</span> },
    { key: 'code', header: 'Code', render: (row) => <span className="text-fg-muted font-mono text-nb-caption">{row.code}</span> },
    {
      key: 'base_hourly_rate',
      header: 'Hourly Rate',
      render: (row) =>
        Number(row.base_hourly_rate) > 0 ? (
          <span className="text-fg">{Number(row.base_hourly_rate).toFixed(2)}</span>
        ) : (
          <span className="text-warning">Not set</span>
        ),
    },
    {
      key: 'overtime_multiplier',
      header: 'Overtime',
      render: (row) => <span className="text-fg-muted">&times;{Number(row.overtime_multiplier || 1.5)}</span>,
    },
    {
      key: 'is_active',
      header: 'Active',
      interactive: true,
      render: (row) =>
        canManage ? (
          <Switch
            name={`lc-active-${row.id}`}
            label={row.is_active ? 'Deactivate' : 'Activate'}
            hideLabel
            checked={row.is_active}
            onCheckedChange={() => handleUpdate(row.id, { is_active: !row.is_active })}
          />
        ) : (
          <Badge tone={row.is_active ? 'primary' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
        ),
    },
  ];
  if (canManage) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      interactive: true,
      render: (row) => (
        <Cluster gap="tight">
          <IconButton label={`Edit ${row.name}`} icon={<Edit2 size={14} />} size="sm" onClick={() => setEditing(row)} />
          <IconButton
            label={`Delete ${row.name}`}
            icon={<Trash2 size={14} />}
            size="sm"
            variant="danger"
            onClick={() => handleDelete(row)}
          />
        </Cluster>
      ),
    } as DataTableColumn<LaborCategory>);
  }

  const emptyNode = loadError ? (
    <EmptyState
      icon={UserCog}
      title="Couldn't load labor categories"
      description="Something went wrong fetching this list. Try refreshing the page."
    />
  ) : (
    <EmptyState
      icon={UserCog}
      title="No labor categories"
      description="Add your first labor category so time entries can be costed."
      action={canManage ? { label: 'Add Labor Category', onClick: () => setShowModal(true) } : undefined}
    />
  );

  return (
    <>
      <ListPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]}
        title="Labor Categories"
        description="Labor classifications and the standard rates used to cost time entries"
        primaryAction={
          canManage ? (
            <Button onClick={() => setShowModal(true)}>
              <Plus size={16} />
              Add Labor Category
            </Button>
          ) : undefined
        }
        loading={loading}
        isEmpty={loadError || rows.length === 0}
        empty={emptyNode}
        kpis={
          // A category with no rate looks configured but cannot cost anyone, so say so.
          !loading && !loadError && unpricedCount > 0 ? (
            <Alert variant="warning" title="Rates not set">
              {unpricedCount === 1
                ? '1 active category has no hourly rate, so it cannot cost an employee who has no rate of their own.'
                : `${unpricedCount} active categories have no hourly rate, so they cannot cost employees who have no rate of their own.`}
            </Alert>
          ) : undefined
        }
      >
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />
      </ListPageTemplate>

      <LaborCategoryFormModal
        isOpen={showModal || !!editing}
        onClose={() => {
          setShowModal(false);
          setEditing(null);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        row={editing}
      />
    </>
  );
};

// =============================================================================

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateLaborCategoryPayload) => void;
  onUpdate: (id: string, data: Partial<CreateLaborCategoryPayload>) => void;
  row: LaborCategory | null;
}

const LaborCategoryFormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  onUpdate,
  row,
}) => {
  const [form, setForm] = useState<CreateLaborCategoryPayload>(BLANK);

  useEffect(() => {
    setForm(
      row
        ? {
            name: row.name,
            code: row.code,
            description: row.description || '',
            base_hourly_rate: Number(row.base_hourly_rate) || 0,
            overtime_multiplier: Number(row.overtime_multiplier) || 1.5,
            is_active: row.is_active,
          }
        : BLANK,
    );
  }, [row, isOpen]);

  const set = (field: keyof CreateLaborCategoryPayload, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return;
    if (row) {
      // `code` is the org-unique key and is not editable — the backend rejects it.
      const { code, ...editable } = form;
      onUpdate(row.id, editable);
    } else {
      onCreate(form);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={row ? 'Edit Labor Category' : 'Add Labor Category'}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="default">
          <FieldGrid columns={2}>
            <TextField
              name="lc-name"
              id="lc-name"
              label="Name *"
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
            <TextField
              name="lc-code"
              id="lc-code"
              label="Code *"
              required
              disabled={!!row}
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              hint={row ? 'Code cannot be changed after creation.' : undefined}
            />
          </FieldGrid>

          <TextField
            name="lc-description"
            id="lc-description"
            label="Description"
            value={form.description || ''}
            onChange={(e) => set('description', e.target.value)}
          />

          <FieldGrid columns={2}>
            <NumberInput
              name="lc-rate"
              id="lc-rate"
              label="Hourly Rate"
              min={0}
              step={0.01}
              value={form.base_hourly_rate}
              onChange={(v) => set('base_hourly_rate', v ?? 0)}
              hint={
                !(Number(form.base_hourly_rate) > 0)
                  ? 'Leave at 0 only if this category should not price time.'
                  : undefined
              }
            />
            <NumberInput
              name="lc-ot"
              id="lc-ot"
              label="Overtime Multiplier"
              min={1}
              step={0.1}
              value={form.overtime_multiplier}
              onChange={(v) => set('overtime_multiplier', v || 1.5)}
            />
          </FieldGrid>

          <Cluster justify="end" gap="tight">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{row ? 'Save Changes' : 'Create'}</Button>
          </Cluster>
        </Stack>
      </form>
    </Modal>
  );
};

export default LaborCategoriesPage;

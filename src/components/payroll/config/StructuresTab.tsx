import React, { useCallback, useEffect, useState } from 'react';
import { Plus, ArrowUp, ArrowDown, Trash2, Copy, FileText, ArrowLeft } from 'lucide-react';
import {
    toast, Alert, Button, Card, Cluster, DataTable, FormActions, Grid, GridItem, IconButton,
    NumberInput, Select, Skeleton, Stack, TextField, Textarea,
} from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import Modal from '../../Modal';
import EmptyState from '../../EmptyState';
import StatusChip from '../StatusChip';
import FieldTooltip from '../FieldTooltip';
import {
    payrollApi, SalaryStructure, SalaryStructureLine, SalaryComponent, StructureValidationResult,
} from '../../../services/payrollApi';

const StructuresTab: React.FC = () => {
    const [structures, setStructures] = useState<SalaryStructure[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<SalaryStructure | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const result = await payrollApi.structures.list();
            setStructures(result.data);
        } catch {
            toast.error('Failed to load salary structures');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openDetail = async (structure: SalaryStructure) => {
        try {
            const full = await payrollApi.structures.get(structure.id);
            setSelected(full);
        } catch {
            toast.error('Failed to load structure detail');
        }
    };

    const handleCreate = async (data: Partial<SalaryStructure>) => {
        try {
            const created = await payrollApi.structures.create(data);
            toast.success('Structure created');
            setShowCreateModal(false);
            load();
            setSelected(created);
        } catch {
            toast.error('Failed to create structure');
        }
    };

    if (loading) return <Skeleton variant="text" lines={6} />;

    if (selected) {
        return <StructureBuilder structure={selected} onBack={() => { setSelected(null); load(); }} onReload={openDetail} />;
    }

    const columns: DataTableColumn<SalaryStructure>[] = [
        { key: 'name', header: 'Name', render: s => <span className="font-medium text-fg">{s.name}</span> },
        { key: 'code', header: 'Code', render: s => <span className="text-fg-muted">{s.code}</span> },
        { key: 'version', header: 'Version', align: 'center', render: s => <span className="text-fg-muted">v{s.version}</span> },
        { key: 'status', header: 'Status', align: 'center', render: s => <StatusChip status={s.status} /> },
        {
            key: 'actions', header: 'Actions', align: 'right',
            render: s => <Button variant="ghost" size="sm" onClick={() => openDetail(s)}>Open</Button>,
        },
    ];

    return (
        <Stack gap="default">
            <Cluster justify="between">
                <h3 className="text-nb-section-title font-semibold text-fg">Salary Structures</h3>
                <Button onClick={() => setShowCreateModal(true)}>
                    <Plus size={13} /> New Structure
                </Button>
            </Cluster>

            {structures.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title="No salary structures"
                    description="A structure defines which components make up an employee's salary and how each is calculated."
                    action={{ label: 'New Structure', onClick: () => setShowCreateModal(true) }}
                />
            ) : (
                <DataTable name="salary-structures" columns={columns} rows={structures} rowKey={s => s.id} />
            )}

            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Salary Structure">
                <CreateStructureForm onCancel={() => setShowCreateModal(false)} onCreate={handleCreate} />
            </Modal>
        </Stack>
    );
};

const CreateStructureForm: React.FC<{
    onCancel: () => void;
    onCreate: (data: Partial<SalaryStructure>) => void;
}> = ({ onCancel, onCreate }) => {
    const [form, setForm] = useState({ name: '', code: '', description: '' });
    return (
        <form onSubmit={e => { e.preventDefault(); if (form.name && form.code) onCreate(form); }}>
            <Stack gap="default">
                <TextField
                    name="structure-name"
                    label="Name"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Standard India — Monthly"
                />
                <TextField
                    name="structure-code"
                    label="Code"
                    required
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="STD_IN_MONTHLY"
                />
                <Textarea
                    name="structure-description"
                    label="Description"
                    rows={2}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
                <FormActions divider onCancel={onCancel} submitLabel="Create" />
            </Stack>
        </form>
    );
};

// =============================================================================
// Structure builder — lines table + validate + sample preview + clone/version
// =============================================================================

const StructureBuilder: React.FC<{
    structure: SalaryStructure;
    onBack: () => void;
    onReload: (structure: SalaryStructure) => void;
}> = ({ structure, onBack, onReload }) => {
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({ currency: settings?.base_currency || 'USD', timezone: settings?.timezone || 'UTC' });
    const [lines, setLines] = useState<SalaryStructureLine[]>(structure.lines || []);
    const [components, setComponents] = useState<SalaryComponent[]>([]);
    const [pickerComponentId, setPickerComponentId] = useState('');
    const [sampleWage, setSampleWage] = useState(50000);
    const [validation, setValidation] = useState<StructureValidationResult | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        payrollApi.components.list({ is_active: true })
            .then(result => setComponents(result.data))
            .catch(() => toast.error('Failed to load components'));
    }, []);

    useEffect(() => { setLines(structure.lines || []); setValidation(null); }, [structure]);

    const componentById = (id: string) => components.find(c => c.id === id);

    const addLine = () => {
        if (!pickerComponentId) return;
        const component = componentById(pickerComponentId);
        if (!component) return;
        if (lines.some(l => l.component_id === pickerComponentId)) {
            toast.error(`${component.name} is already in this structure`);
            return;
        }
        setLines(prev => [...prev, {
            component_id: component.id,
            component_code: component.code,
            component_name: component.name,
            kind: component.kind,
            calc_override: null,
            display_order: prev.length + 1,
        }]);
        setPickerComponentId('');
    };

    const move = (index: number, direction: -1 | 1) => {
        setLines(prev => {
            const next = [...prev];
            const target = index + direction;
            if (target < 0 || target >= next.length) return prev;
            [next[index], next[target]] = [next[target], next[index]];
            return next.map((line, i) => ({ ...line, display_order: i + 1 }));
        });
    };

    const removeLine = (index: number) =>
        setLines(prev => prev.filter((_, i) => i !== index).map((line, i) => ({ ...line, display_order: i + 1 })));

    const setOverride = (index: number, amount: number | null) => {
        setLines(prev => prev.map((line, i) => {
            if (i !== index) return line;
            if (amount === null) return { ...line, calc_override: null };
            return Number.isNaN(amount) ? line : { ...line, calc_override: { amount } };
        }));
    };

    const handleSaveLines = async () => {
        try {
            setSaving(true);
            await payrollApi.structures.saveLines(structure.id, lines);
            toast.success('Structure lines saved');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save lines');
        } finally {
            setSaving(false);
        }
    };

    const handleValidate = async () => {
        try {
            await payrollApi.structures.saveLines(structure.id, lines);
            const result = await payrollApi.structures.validate(structure.id, { monthly_wage: sampleWage });
            setValidation(result);
            if (result.valid) toast.success('Structure is valid');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Validation failed');
        }
    };

    const handleClone = async () => {
        try {
            const clone = await payrollApi.structures.clone(structure.id);
            toast.success(`Cloned as ${clone.name}`);
            onReload(clone);
        } catch {
            toast.error('Failed to clone structure');
        }
    };

    const handleNewVersion = async () => {
        try {
            const version = await payrollApi.structures.newVersion(structure.id);
            toast.success(`Created version ${version.version}. Existing assignments stay pinned to their version.`);
            onReload(version);
        } catch {
            toast.error('Failed to create a new version');
        }
    };

    const lineColumns: DataTableColumn<SalaryStructureLine>[] = [
        {
            key: 'order', header: 'Order',
            render: line => <span className="text-fg-muted">{lines.indexOf(line) + 1}</span>,
        },
        {
            key: 'component', header: 'Component',
            render: line => (
                <Stack gap="tight">
                    <span className="font-medium text-fg">{line.component_code || componentById(line.component_id)?.code}</span>
                    <span className="text-nb-caption text-fg-muted">{line.component_name || componentById(line.component_id)?.name}</span>
                </Stack>
            ),
        },
        {
            key: 'kind', header: 'Kind', align: 'center',
            render: line => <StatusChip status={line.kind || componentById(line.component_id)?.kind || 'earning'} />,
        },
        {
            key: 'override', header: 'Override',
            render: line => (
                <NumberInput
                    name={`override-${line.component_id}`}
                    aria-label={`Override amount for ${line.component_code}`}
                    step={0.01}
                    placeholder="default"
                    value={line.calc_override?.amount ?? null}
                    onChange={v => setOverride(lines.indexOf(line), v)}
                />
            ),
        },
        {
            key: 'actions', header: 'Actions', align: 'right',
            render: line => {
                const index = lines.indexOf(line);
                return (
                    <Cluster justify="end">
                        <IconButton label="Move up" icon={<ArrowUp size={13} />} onClick={() => move(index, -1)} />
                        <IconButton label="Move down" icon={<ArrowDown size={13} />} onClick={() => move(index, 1)} />
                        <IconButton label="Remove line" icon={<Trash2 size={13} />} onClick={() => removeLine(index)} />
                    </Cluster>
                );
            },
        },
    ];

    return (
        <Stack gap="default">
            <Cluster justify="between">
                <Cluster>
                    <IconButton label="Back to structures" icon={<ArrowLeft size={16} />} onClick={onBack} />
                    <Stack gap="tight">
                        <Cluster>
                            <h3 className="text-nb-section-title font-semibold text-fg">{structure.name}</h3>
                            <StatusChip status={structure.status} />
                            <span className="text-nb-caption text-fg-subtle">v{structure.version}</span>
                        </Cluster>
                        <p className="text-nb-caption text-fg-muted">{structure.code}</p>
                    </Stack>
                </Cluster>
                <Cluster>
                    <Button variant="secondary" size="sm" onClick={handleClone}>
                        <Copy size={12} /> Clone
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleNewVersion}>
                        <Plus size={12} /> New Version
                    </Button>
                </Cluster>
            </Cluster>

            <Grid columns="auto" gap="md">
                <GridItem span={8}>
                    <Stack gap="default">
                        <Cluster>
                            <Select
                                name="add-component"
                                aria-label="Add component"
                                value={pickerComponentId}
                                onChange={e => setPickerComponentId(e.target.value)}
                                options={[{ value: '', label: 'Add a component…' }, ...components.map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }))]}
                            />
                            <Button onClick={addLine}>
                                <Plus size={13} /> Add
                            </Button>
                        </Cluster>

                        {lines.length === 0 ? (
                            <p className="text-nb-body text-fg-muted py-nb-6 text-center bg-surface border border-line rounded-nb">
                                No components yet. Add components to build this structure.
                            </p>
                        ) : (
                            <Stack gap="tight">
                                <DataTable name="structure-lines" columns={lineColumns} rows={lines} rowKey={l => l.component_id} />
                                <Cluster>
                                    <span className="text-nb-caption text-fg-muted">Override: optional fixed amount for this structure only.</span>
                                    <FieldTooltip text="Optional fixed amount overriding the component's default calculation for this structure only. Leave blank to use the component default." />
                                </Cluster>
                            </Stack>
                        )}

                        <Cluster justify="end">
                            <Button variant="secondary" onClick={handleValidate}>Validate</Button>
                            <Button onClick={handleSaveLines} disabled={saving}>
                                {saving ? 'Saving…' : 'Save Lines'}
                            </Button>
                        </Cluster>
                    </Stack>
                </GridItem>

                <GridItem span={4}>
                    <Stack gap="default">
                        <Card title="Sample Preview">
                            <Stack gap="default">
                                <NumberInput
                                    name="sample-monthly-wage"
                                    label="Sample monthly wage"
                                    min={0}
                                    value={sampleWage}
                                    onChange={v => setSampleWage(v || 0)}
                                />
                                <p className="text-nb-caption text-fg-subtle">Validate runs a server dry-run: the DAG order below is the exact order the engine will evaluate.</p>
                            </Stack>
                        </Card>

                        {validation && (
                            <Alert variant={validation.valid ? 'success' : 'error'} title={validation.valid ? 'Valid structure' : 'Validation failed'}>
                                <Stack gap="tight">
                                    {validation.errors?.map((error, i) => (
                                        <p key={i} className="text-nb-caption text-danger">{error}</p>
                                    ))}
                                    {validation.order && validation.order.length > 0 && (
                                        <Stack gap="tight">
                                            <p className="text-nb-caption text-fg-muted">Evaluation order:</p>
                                            <p className="text-nb-caption font-mono text-fg">{validation.order.join(' → ')}</p>
                                        </Stack>
                                    )}
                                    {validation.preview && validation.preview.length > 0 && (
                                        <Stack gap="tight">
                                            {validation.preview.map(row => (
                                                <Cluster key={row.component_code} justify="between">
                                                    <span className="text-nb-caption text-fg-muted">{row.component_code}</span>
                                                    <span className="text-nb-caption text-fg">{row.amount !== undefined ? formatters.formatCurrency(row.amount) : '—'}</span>
                                                </Cluster>
                                            ))}
                                        </Stack>
                                    )}
                                </Stack>
                            </Alert>
                        )}
                    </Stack>
                </GridItem>
            </Grid>
        </Stack>
    );
};

export default StructuresTab;

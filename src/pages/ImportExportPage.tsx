import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Upload, FileDown, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import {
    toast, Select, Alert, Button, Card, Checkbox, Cluster, FieldGrid, SettingsPageTemplate, Stack, Tabs,
} from '@so360/design-system';
import { peopleApi } from '../services/peopleService';
import { departmentsApi, Department } from '../services/departmentsService';

type BulkTab = 'export' | 'import';

const ImportExportPage: React.FC = () => {
    // Import and Export are separate workflows on one Data Management page.
    // The entry point decides which one opens (`?tab=import` from the People
    // Registry's Import button) so the user never lands on the other section.
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab: BulkTab = searchParams.get('tab') === 'import' ? 'import' : 'export';
    const setActiveTab = (tab: BulkTab) => setSearchParams({ tab }, { replace: true });
    const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [departmentFilter, setDepartmentFilter] = useState<string>('');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [validateOnly, setValidateOnly] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [validationResults, setValidationResults] = useState<{
        success: number;
        errors: Array<{ row: number; field: string; message: string }>;
    } | null>(null);
    const [departments, setDepartments] = useState<Department[]>([]);

    useEffect(() => {
        departmentsApi.getAll({ is_active: true }).then(res => {
            setDepartments(res.data || []);
        }).catch(() => { /* ignore */ });
    }, []);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const filters: Record<string, string> = {};
            if (statusFilter) filters.status = statusFilter;
            if (typeFilter) filters.type = typeFilter;
            if (departmentFilter) filters.department_id = departmentFilter;

            const blob = await peopleApi.export(exportFormat, filters);

            // Download the file
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `people-export.${exportFormat === 'excel' ? 'xlsx' : 'csv'}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            toast.success(`Exported successfully as ${exportFormat.toUpperCase()}`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to export people');
        } finally {
            setIsExporting(false);
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const blob = await peopleApi.getImportTemplate();

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'people-import-template.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            toast.success('Template downloaded successfully');
        } catch (error: any) {
            toast.error(error.message || 'Failed to download template');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImportFile(file);
            setValidationResults(null);
        }
    };

    const handleImport = async () => {
        if (!importFile) return;

        setIsImporting(true);
        try {
            if (validateOnly) {
                const result = await peopleApi.validateImport(importFile);
                setValidationResults({
                    success: result.errors?.length === 0 ? 1 : 0,
                    errors: result.errors || [],
                });

                if (!result.errors || result.errors.length === 0) {
                    toast.success('Validation successful! All records are valid.');
                } else {
                    toast.error(`Validation found ${result.errors.length} errors.`);
                }
            } else {
                const result = await peopleApi.import(importFile);
                setValidationResults({
                    success: result.success || 0,
                    errors: result.errors || [],
                });

                if (!result.errors || result.errors.length === 0) {
                    toast.success(`Import successful! ${result.success} people imported.`);
                    setImportFile(null);
                } else {
                    toast.error(`Imported ${result.success} records with ${result.errors.length} errors.`);
                }
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to process import');
        } finally {
            setIsImporting(false);
        }
    };

    const exportSection = (
        <Card title="Export People">
            <Stack gap="default">
                <FieldGrid>
                    <Select name="importexport-select-49" label="Format" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as 'csv' | 'excel')} options={[{ value: "csv", label: "CSV" }, { value: "excel", label: "Excel" }]} />
                    <Select name="importexport-select-50" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[{ value: "", label: "All Statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "on_leave", label: "On Leave" }, { value: "terminated", label: "Terminated" }]} />
                    <Select name="importexport-select-51" label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={[{ value: "", label: "All Types" }, { value: "employee", label: "Employee" }, { value: "contractor", label: "Contractor" }]} />
                    <Select name="importexport-select-52" label="Department" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} options={[{ value: "", label: "All Departments" }, ...departments.map((dept) => ({ value: dept.id, label: dept.name }))]} />
                </FieldGrid>

                <Cluster gap="default">
                    <Button onClick={handleExport} disabled={isExporting}>
                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        {isExporting ? 'Exporting...' : 'Export People'}
                    </Button>
                    <Button variant="secondary" onClick={handleDownloadTemplate}>
                        <FileDown size={16} />
                        Download Template
                    </Button>
                </Cluster>
            </Stack>
        </Card>
    );

    const importSection = (
        <Card title="Import People">
            <Stack gap="default">
                {/* File Upload — compact drop zone. */}
                <Stack gap="tight">
                    <Cluster justify="between">
                        <label htmlFor="file-upload" className="text-nb-caption text-fg-muted">Upload File</label>
                        <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
                            <FileDown size={13} />
                            Download Template
                        </Button>
                    </Cluster>
                    <div className="border border-line rounded-nb px-nb-4 py-nb-5 text-center">
                        <input // comb-exception: hidden file input driven by the label
                            type="file"
                            name="import-file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileChange}
                            className="hidden"
                            id="file-upload"
                        />
                        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                            <Upload size={28} className="text-fg-muted mb-nb-2" />
                            <p className="text-nb-body text-fg">
                                {importFile ? importFile.name : 'Click to browse or drag and drop'}
                            </p>
                            <p className="text-nb-caption text-fg-muted">
                                Supports CSV and Excel files
                            </p>
                        </label>
                    </div>
                </Stack>

                <Checkbox
                    name="import-validate-only"
                    label="Validate Only (Don't import yet)"
                    checked={validateOnly}
                    onChange={(e) => setValidateOnly(e.target.checked)}
                />

                <Cluster>
                    <Button onClick={handleImport} disabled={!importFile || isImporting}>
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {isImporting ? 'Processing...' : validateOnly ? 'Validate' : 'Import'}
                    </Button>
                </Cluster>

                {validationResults && (
                    <Stack gap="default">
                        {validationResults.success > 0 && (
                            <Alert variant="success">
                                {`${validationResults.success} records validated successfully`}
                            </Alert>
                        )}

                        {validationResults.errors.length > 0 && (
                            <Alert variant="error">
                                <Stack gap="tight">
                                    <p className="text-nb-label">{`${validationResults.errors.length} errors found`}</p>
                                    {validationResults.errors.map((error, index) => (
                                        <div key={index}>
                                            <p className="text-nb-caption text-fg">
                                                Row {error.row} - Field: {error.field}
                                            </p>
                                            <p className="text-nb-caption text-fg-muted">{error.message}</p>
                                        </div>
                                    ))}
                                </Stack>
                            </Alert>
                        )}

                        {validateOnly && validationResults.errors.length === 0 && validationResults.success > 0 && (
                            <Alert
                                variant="info"
                                action={{
                                    label: 'Proceed with Import',
                                    onClick: () => {
                                        setValidateOnly(false);
                                        handleImport();
                                    },
                                }}
                            >
                                All records are valid. Ready to import?
                            </Alert>
                        )}
                    </Stack>
                )}
            </Stack>
        </Card>
    );

    return (
        <SettingsPageTemplate trail={[]}
            title="Data Management"
            description="Bulk import and export for people data"
        >
            {/* Workflow tabs — only one workflow is ever on screen, so Import
                never shows Export controls and vice versa. */}
            <Tabs
                name="bulk-workflow"
                items={[
                    { id: 'export', label: 'Export People' },
                    { id: 'import', label: 'Import People' },
                ]}
                value={activeTab}
                onChange={(id: string) => setActiveTab(id as BulkTab)}
            >
                {(tab: string) => (tab === 'export' ? exportSection : importSection)}
            </Tabs>
        </SettingsPageTemplate>
    );
};

export default ImportExportPage;

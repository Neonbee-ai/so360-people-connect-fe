import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Upload, FileDown, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { toast, Select } from '@so360/design-system';
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

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Data Management"
                subtitle="Bulk import and export for people data"
            />

            {/* Workflow tabs — only one workflow is ever on screen, so Import
                never shows Export controls and vice versa. */}
            <div className="flex items-center gap-1 border-b border-line" role="tablist">
                {(['export', 'import'] as BulkTab[]).map(tab => (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab
                                ? 'border-primary text-primary'
                                : 'border-transparent text-fg-muted hover:text-fg'
                        }`}
                    >
                        {tab === 'export' ? 'Export People' : 'Import People'}
                    </button>
                ))}
            </div>

            {/* Export Section */}
            {activeTab === 'export' && (
            <div className="bg-surface border border-line rounded-nb p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Download size={20} className="text-primary" />
                    <h2 className="text-lg font-medium text-fg">Export People</h2>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs text-fg-muted mb-1">Format</label>
                            <Select name="importexport-select-49" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as 'csv' | 'excel')} options={[{ value: "csv", label: "CSV" }, { value: "excel", label: "Excel" }]} />
                        </div>
                        <div>
                            <label className="block text-xs text-fg-muted mb-1">Status</label>
                            <Select name="importexport-select-50" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[{ value: "", label: "All Statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "on_leave", label: "On Leave" }, { value: "terminated", label: "Terminated" }]} />
                        </div>
                        <div>
                            <label className="block text-xs text-fg-muted mb-1">Type</label>
                            <Select name="importexport-select-51" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={[{ value: "", label: "All Types" }, { value: "employee", label: "Employee" }, { value: "contractor", label: "Contractor" }]} />
                        </div>
                        <div>
                            <label className="block text-xs text-fg-muted mb-1">Department</label>
                            <Select name="importexport-select-52" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} options={[{ value: "", label: "All Departments" }, ...departments.map((dept) => ({ value: dept.id, label: dept.name }))]} />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            {isExporting ? 'Exporting...' : 'Export People'}
                        </button>
                        <button
                            onClick={handleDownloadTemplate}
                            className="flex items-center gap-2 px-4 py-2 bg-line hover:bg-line-strong text-fg text-sm font-medium rounded-nb transition-colors"
                        >
                            <FileDown size={16} />
                            Download Template
                        </button>
                    </div>
                </div>
            </div>
            )}

            {/* Import Section */}
            {activeTab === 'import' && (
            <div className="bg-surface border border-line rounded-nb p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Upload size={20} className="text-primary" />
                    <h2 className="text-lg font-medium text-fg">Import People</h2>
                </div>

                <div className="space-y-4">
                    {/* File Upload — compact drop zone. The old p-8 + h-12 icon
                        pushed the Validate button below the fold on a standard
                        desktop viewport. */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label htmlFor="file-upload" className="text-xs text-fg-muted">Upload File</label>
                            <button
                                type="button"
                                onClick={handleDownloadTemplate}
                                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary transition-colors"
                            >
                                <FileDown size={13} />
                                Download Template
                            </button>
                        </div>
                        <div className="border-2 border-dashed border-line-strong rounded-nb px-4 py-5 text-center hover:border-line-strong transition-colors">
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                            />
                            <label
                                htmlFor="file-upload"
                                className="cursor-pointer flex flex-col items-center"
                            >
                                <Upload className="h-7 w-7 text-fg-subtle mb-2" />
                                <p className="text-sm text-fg">
                                    {importFile ? importFile.name : 'Click to browse or drag and drop'}
                                </p>
                                <p className="text-xs text-fg-subtle">
                                    Supports CSV and Excel files
                                </p>
                            </label>
                        </div>
                    </div>

                    {/* Validate Only Checkbox */}
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={validateOnly}
                            onChange={(e) => setValidateOnly(e.target.checked)}
                            className="w-4 h-4 rounded border-line-strong bg-surface-raised text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-fg">Validate Only (Don't import yet)</span>
                    </label>

                    {/* Import Button */}
                    <button
                        onClick={handleImport}
                        disabled={!importFile || isImporting}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {isImporting ? 'Processing...' : validateOnly ? 'Validate' : 'Import'}
                    </button>

                    {/* Validation Results */}
                    {validationResults && (
                        <div className="mt-6 space-y-4">
                            {/* Success Count */}
                            {validationResults.success > 0 && (
                                <div className="bg-success-container/20 border border-success rounded-nb p-4">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="text-success" size={20} />
                                        <p className="text-sm font-medium text-success">
                                            {validationResults.success} records validated successfully
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Errors */}
                            {validationResults.errors.length > 0 && (
                                <div className="bg-danger-container/20 border border-danger rounded-nb p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlertCircle className="text-danger" size={20} />
                                        <p className="text-sm font-medium text-danger">
                                            {validationResults.errors.length} errors found
                                        </p>
                                    </div>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {validationResults.errors.map((error, index) => (
                                            <div key={index} className="bg-surface rounded-nb p-3">
                                                <p className="text-xs text-danger font-medium mb-1">
                                                    Row {error.row} - Field: {error.field}
                                                </p>
                                                <p className="text-xs text-fg-muted">{error.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action after validation */}
                            {validateOnly && validationResults.errors.length === 0 && validationResults.success > 0 && (
                                <div className="bg-surface-raised border border-line-strong rounded-nb p-4">
                                    <p className="text-sm text-fg mb-3">
                                        All records are valid. Ready to import?
                                    </p>
                                    <button
                                        onClick={() => {
                                            setValidateOnly(false);
                                            handleImport();
                                        }}
                                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors"
                                    >
                                        Proceed with Import
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            )}

        </div>
    );
};

export default ImportExportPage;

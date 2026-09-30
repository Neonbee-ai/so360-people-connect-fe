import { peopleApi } from '../services/peopleService';
import type { DlSaveResult } from './peopleDataLayer';

/**
 * Class B save path (spec L2: "Who writes: the module").
 *
 * Custom-field values live in the person row's own `custom_fields` JSONB and are
 * written through the NATIVE People Connect API (PATCH /people/:id), never
 * through datasetsClient. Changed keys are merged over the current values so a
 * renderer that saves one field never drops the others.
 *
 * NOTE: this is separate from the legacy per-org custom-field-defs/values
 * tables (customFieldsService). Those keep working unchanged.
 */

export function currentClassBValues(record: Record<string, any> | null | undefined): Record<string, unknown> {
    const raw = record?.custom_fields;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
}

export function classBRecordView(record: Record<string, any> | null | undefined): Record<string, unknown> | null {
    if (!record) return null;
    return { ...record, custom_fields: currentClassBValues(record) };
}

export function recordVersion(record: Record<string, any> | null | undefined): number | string | null {
    if (!record) return null;
    return record.version ?? record.updated_at ?? null;
}

export async function saveClassBCustomFields(
    recordId: string,
    current: Record<string, any> | null | undefined,
    changed: Record<string, unknown>,
): Promise<DlSaveResult> {
    const custom_fields = { ...currentClassBValues(current), ...changed };
    try {
        const saved: any = await peopleApi.update(recordId, { custom_fields });
        return { ok: true, record: classBRecordView(saved ?? { ...(current ?? {}), custom_fields }) ?? undefined };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Failed to save custom fields' };
    }
}

import type { CreateMasterPayload, MasterRow } from '../services/mastersService';

/**
 * The body a master add/edit form sends. `is_contractor` goes out only when the
 * list shows that flag AND the user set or changed it, so other master lists,
 * and saves that leave it untouched, never write the column.
 */
export const masterPayloadForSubmit = (
  form: CreateMasterPayload,
  row: Pick<MasterRow, 'is_contractor'> | null,
  showContractorFlag: boolean,
): CreateMasterPayload => {
  const { is_contractor, ...rest } = form;
  if (!showContractorFlag || typeof is_contractor !== 'boolean') return rest;
  if (row && is_contractor === !!row.is_contractor) return rest;
  return { ...rest, is_contractor };
};

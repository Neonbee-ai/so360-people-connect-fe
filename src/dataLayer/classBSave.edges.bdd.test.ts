import { describe, it, expect, vi, beforeEach } from 'vitest';

// Class B save path for people: error shapes, response shapes and fallbacks.

const api = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock('../services/peopleService', () => ({
  peopleApi: { update: (...a: unknown[]) => api.update(...a) },
}));

import {
  saveClassBCustomFields,
  isVersionConflict,
  wireVersion,
  classBVersionOf,
  classBRecordView,
} from './classBSave';

beforeEach(() => {
  api.update.mockReset();
});

describe('Feature: Person Class B version helpers', () => {
  describe('Scenario: non-integer versions', () => {
    it('then fractional and string row versions are not treated as a custom_fields_version', () => {
      // Given rows with malformed versions / When / Then
      expect(classBVersionOf({ custom_fields_version: 2.5 })).toBeNull();
      expect(classBVersionOf({ custom_fields_version: '3' })).toBeNull();
      expect(classBVersionOf(undefined)).toBeNull();
      expect(wireVersion(4.5)).toBeUndefined();
      expect(wireVersion(undefined)).toBeUndefined();
    });
  });

  describe('Scenario: record view of a missing row', () => {
    it('then it is null, and an existing row gets a normalised custom_fields object', () => {
      expect(classBRecordView(null)).toBeNull();
      expect(classBRecordView({ id: 'i1', custom_fields: 'bad' })).toEqual({ id: 'i1', custom_fields: {} });
    });
  });
});

describe('Feature: Person version conflict detection', () => {
  describe('Scenario: conflict signalled in other error shapes', () => {
    it('then statusCode, response.status, response.data.code and body.error are recognised', () => {
      expect(isVersionConflict({ statusCode: 409 })).toBe(true);
      expect(isVersionConflict({ response: { status: 409 } })).toBe(true);
      expect(isVersionConflict({ response: { data: { code: 'DATASET_VERSION_CONFLICT' } } })).toBe(true);
      expect(isVersionConflict({ body: { error: 'DATASET_VERSION_CONFLICT' } })).toBe(true);
    });

    it('then malformed status and code values are not conflicts', () => {
      expect(isVersionConflict({ status: '409' })).toBe(false);
      expect(isVersionConflict({ code: 409 })).toBe(false);
      expect(isVersionConflict(null)).toBe(false);
    });
  });
});

describe('Feature: Saving person Class B custom fields — edges', () => {
  describe('Given a digit-string version is passed explicitly', () => {
    it('then it is sent as a number', async () => {
      api.update.mockResolvedValue({ id: 'i1', custom_fields: { a: 1 } });
      // When
      await saveClassBCustomFields('i1', null, { a: 1 }, '5');
      // Then
      expect(api.update).toHaveBeenCalledWith('i1', { custom_fields: { a: 1 }, version: 5 });
    });
  });

  describe('Given an explicit null version', () => {
    it('then no version is sent even when the row carries one', async () => {
      api.update.mockResolvedValue({ id: 'i1', custom_fields: { a: 1 } });
      await saveClassBCustomFields('i1', { custom_fields_version: 3 }, { a: 1 }, null);
      expect(api.update).toHaveBeenCalledWith('i1', { custom_fields: { a: 1 } });
    });
  });

  describe('Given a non-object response', () => {
    it('then the current row is kept with the locally merged values', async () => {
      api.update.mockResolvedValue('OK');
      const res = await saveClassBCustomFields('i1', { id: 'i1', custom_fields: { a: 1 } }, { a: 2 }, 1);
      expect(res).toEqual({ ok: true, record: { id: 'i1', custom_fields: { a: 2 } } });
    });
  });

  describe('Given the response is an object without custom_fields', () => {
    it('then the response fields are merged over the current row with locally merged values', async () => {
      // Given the backend echoes only row metadata
      api.update.mockResolvedValue({ updated_at: 'u2', custom_fields_version: 2 });
      // When a key is added and another cleared
      const res = await saveClassBCustomFields('i1', { id: 'i1', custom_fields: { a: 1, c: 3 } }, { b: 2, c: null }, 1);
      // Then the view mirrors the backend merge
      expect(res).toEqual({ ok: true, record: { id: 'i1', updated_at: 'u2', custom_fields_version: 2, custom_fields: { a: 1, b: 2 } } });
    });
  });

  describe('Given the response is null and there is no current row', () => {
    it('then the view holds only the changed values', async () => {
      api.update.mockResolvedValue(null);
      const res = await saveClassBCustomFields('i1', null, { a: 1 }, 1);
      expect(res).toEqual({ ok: true, record: { custom_fields: { a: 1 } } });
    });
  });

  describe('Given the backend rejects with a 409 carrying an array message', () => {
    it('then the result is a conflict with the joined message', async () => {
      api.update.mockRejectedValue({ response: { status: 409, data: { message: ['stale', 'reload'] } } });
      const res = await saveClassBCustomFields('i1', null, { a: 1 }, 1);
      expect(res).toEqual({ ok: false, conflict: true, error: 'stale; reload' });
    });
  });

  describe('Given a 400 DATASET_FIELD_* with a blank body message', () => {
    it('then the error message is used', async () => {
      api.update.mockRejectedValue({ status: 400, body: { code: 'DATASET_FIELD_TYPE', message: '  ' }, message: 'Bad Request' });
      const res = await saveClassBCustomFields('i1', null, { a: 1 }, 1);
      expect(res).toEqual({ ok: false, error: 'Bad Request' });
    });
  });

  describe('Given an error with no usable message', () => {
    it('then the default message is used for a blank message', async () => {
      api.update.mockRejectedValue({ message: '   ' });
      const res = await saveClassBCustomFields('i1', null, { a: 1 }, 1);
      expect(res).toEqual({ ok: false, error: 'Failed to save custom fields' });
    });

    it('then the default message is used for a null rejection', async () => {
      api.update.mockRejectedValue(null);
      const res = await saveClassBCustomFields('i1', null, { a: 1 }, 1);
      expect(res).toEqual({ ok: false, error: 'Failed to save custom fields' });
    });
  });
});

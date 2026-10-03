import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { coreGatewayUrl, resolveCoreGatewayBase } from './coreGateway';

/**
 * BDD: preview hosts (pr-<slug>.skyoffice360.com) do not route bare relative
 * `/v1/...` fetches. Direct Core calls (UserSelector members list, business
 * settings, department scopes) must use the gateway the shell injects on
 * window, then the literal build env, then their historical fallback.
 */
describe('Core gateway resolution', () => {
  beforeEach(() => {
    delete (window as any).VITE_SO360_CORE_API;
    vi.stubEnv('VITE_SO360_CORE_API', '');
  });

  afterEach(() => {
    delete (window as any).VITE_SO360_CORE_API;
    vi.unstubAllEnvs();
  });

  describe('Given the shell injected window.VITE_SO360_CORE_API', () => {
    beforeEach(() => {
      (window as any).VITE_SO360_CORE_API = 'https://dev-api.skyoffice360.com/core/';
    });

    it('When building the members URL / Then it is routed through the gateway', () => {
      expect(coreGatewayUrl('/v1/tenancy/members?org_id=org-1')).toBe(
        'https://dev-api.skyoffice360.com/core/v1/tenancy/members?org_id=org-1',
      );
    });

    it('When the build env also has a value / Then the window value wins', () => {
      vi.stubEnv('VITE_SO360_CORE_API', 'https://api.neonbee.app/core');
      expect(resolveCoreGatewayBase()).toBe('https://dev-api.skyoffice360.com/core');
    });

    it('When a fallback is supplied / Then the gateway still takes precedence', () => {
      expect(coreGatewayUrl('/v1/business-settings/org-1', '/core-api')).toBe(
        'https://dev-api.skyoffice360.com/core/v1/business-settings/org-1',
      );
    });
  });

  describe('Given only the build-time env is set', () => {
    it('When resolving / Then the literal env value is used', () => {
      vi.stubEnv('VITE_SO360_CORE_API', 'https://api.neonbee.app/core');
      expect(coreGatewayUrl('/v1/tenancy/members?org_id=org-1')).toBe(
        'https://api.neonbee.app/core/v1/tenancy/members?org_id=org-1',
      );
    });
  });

  describe('Given no gateway is configured', () => {
    it('When building the members URL / Then the relative path is unchanged', () => {
      expect(coreGatewayUrl('/v1/tenancy/members?org_id=org-1')).toBe('/v1/tenancy/members?org_id=org-1');
    });

    it('When a fallback is supplied / Then the historical fallback is kept', () => {
      expect(coreGatewayUrl('/v1/business-settings/org-1', '/core-api')).toBe('/core-api/v1/business-settings/org-1');
    });

    it('When window holds a blank string / Then it is ignored', () => {
      (window as any).VITE_SO360_CORE_API = '   ';
      expect(resolveCoreGatewayBase()).toBe('');
    });
  });
});

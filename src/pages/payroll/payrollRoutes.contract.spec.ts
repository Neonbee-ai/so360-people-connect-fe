import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Route contract for the Payroll surface.
 *
 * Root cause this closes: every payroll navigation was written shell-root
 * absolute (`/payroll/runs`) while this MFE mounts under `/people/*`, so
 * "Start your first payroll run", the run rows and the person deep links all
 * landed on routes the shell does not have — page-not-found in production.
 * The page specs did not catch it because each asserted the same wrong path
 * the component used; expectations written by hand cannot police the paths
 * they were copied from.
 *
 * So this spec derives both sides from source: the declared route table in
 * App.tsx, and every internal link literal in the payroll files. A link that
 * cannot be matched to a declared route fails here, before it ships.
 *
 * Files are read from process.cwd() — jsdom's URL realm makes import.meta.url
 * resolution unreliable in this repo's setup.
 */

const ROOT = process.cwd();
const MFE_MOUNT = '/people';

/** `<Route path="x" .../>` declarations, as mounted paths. */
function declaredRoutes(): string[] {
    const src = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');
    return [...src.matchAll(/<Route\s+path="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((p) => p !== '*')
        .map((p) => `${MFE_MOUNT}/${p}`.replace(/\/+/g, '/'));
}

/** Every payroll source file (components + pages), excluding specs. */
function payrollSourceFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.tsx?$/.test(entry.name) && !/\.spec\.|\.bdd\./.test(entry.name)) out.push(full);
        }
    };
    walk(resolve(ROOT, 'src/pages/payroll'));
    walk(resolve(ROOT, 'src/components/payroll'));
    return out;
}

/** Internal absolute link targets: navigate('/x'), navigate(`/x`), to="/x", to={`/x`}. */
function internalLinks(): { file: string; target: string }[] {
    const found: { file: string; target: string }[] = [];
    for (const file of payrollSourceFiles()) {
        const src = readFileSync(file, 'utf8');
        const patterns = [
            /navigate\(\s*['"`](\/[^'"`]*)['"`]/g,
            /\bto=\{?\s*['"`](\/[^'"`]*)['"`]/g,
        ];
        for (const re of patterns) {
            for (const m of src.matchAll(re)) {
                found.push({ file: file.replace(`${ROOT}/`, ''), target: m[1] });
            }
        }
    }
    return found;
}

/** Strip query/hash, then match a concrete path against a route pattern. */
function matchesRoute(target: string, route: string): boolean {
    const path = target.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    const t = path.split('/').filter(Boolean);
    const r = route.split('/').filter(Boolean);
    if (t.length !== r.length) return false;
    return r.every((seg, i) => seg.startsWith(':') || seg === t[i]);
}

describe('GIVEN the Payroll route contract', () => {
    const routes = declaredRoutes();
    const links = internalLinks();

    it('WHEN App.tsx is read THEN the payroll route table is present', () => {
        // Guards against the extraction silently returning nothing, which would
        // make every assertion below vacuously pass.
        expect(routes.length).toBeGreaterThan(10);
        expect(routes).toContain('/people/payroll');
        expect(routes).toContain('/people/payroll/runs/:id');
    });

    it('WHEN payroll sources are scanned THEN internal links are found', () => {
        expect(links.length).toBeGreaterThan(0);
    });

    it.each(links.map((l) => [l.target, l.file] as const))(
        'WHEN %s (%s) is followed THEN it resolves to a declared route',
        (target, file) => {
            const ok = routes.some((r) => matchesRoute(target, r));
            expect(
                ok,
                `${file} links to "${target}", which matches no route in App.tsx. ` +
                    `Remember this MFE is mounted at ${MFE_MOUNT}/* — internal links must ` +
                    `carry that prefix (e.g. /people/payroll/runs, /people/people/:id).`,
            ).toBe(true);
        },
    );

    it('WHEN any internal link is inspected THEN it carries the MFE mount prefix', () => {
        const unprefixed = links
            .filter((l) => !l.target.startsWith(`${MFE_MOUNT}/`))
            .map((l) => `${l.file}: ${l.target}`);
        expect(unprefixed).toEqual([]);
    });

    it('WHEN the shell sidenav targets are checked THEN every one has a route here', () => {
        // Mirrors so360-shell-fe/src/config/moduleNavConfig.ts (People → Payroll).
        // A nav entry without a route renders page-not-found on click.
        const shellNavTargets = [
            '/people/payroll',
            '/people/payroll/runs',
            '/people/payroll/payslips',
            '/people/payroll/tax-declarations',
            '/people/payroll/reports',
            '/people/payroll/configuration',
            '/people/my/payslips',
        ];
        for (const target of shellNavTargets) {
            expect(
                routes.some((r) => matchesRoute(target, r)),
                `shell sidenav points at "${target}" but no route declares it`,
            ).toBe(true);
        }
    });
});

describe('GIVEN payroll route permission guards', () => {
    const src = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');

    /** Guard codes on a payroll route, in declaration order. */
    const guardFor = (path: string): string[] => {
        const re = new RegExp(
            `<Route path="${path.replace(/[/:]/g, (c) => '\\' + c)}" element=\\{<PermissionGuard permission=(\\{\\[[^\\]]*\\]\\}|"[^"]*")`,
        );
        const m = src.match(re);
        if (!m) return [];
        return [...m[1].matchAll(/['"]([a-z_.]+)['"]/g)].map((x) => x[1]);
    };

    // The nav must never advertise a page whose guard would refuse the click,
    // and the guard must never be stricter than the backend's own any-of check
    // (people-connect-be uses PAYROLL.TAX_MANAGE-or-READ / REPORTS-or-READ).
    it.each([
        ['payroll', ['payroll.read']],
        ['payroll/runs', ['payroll.read']],
        ['payroll/payslips', ['payroll.read']],
        ['payroll/tax-declarations', ['payroll.tax_manage', 'payroll.read']],
        ['payroll/reports', ['payroll.reports', 'payroll.read']],
        ['payroll/configuration', ['payroll.config']],
    ])('WHEN %s is guarded THEN it requires %j (mirroring nav + backend)', (path, expected) => {
        expect(guardFor(path as string)).toEqual(expected);
    });
});

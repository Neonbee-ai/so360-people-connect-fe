import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useShellBridge } from '@so360/shell-context';
import { FeatureRoute as FeatureRouteBase } from '@so360/design-system';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FeatureRoute = FeatureRouteBase as any;
import { peopleService } from './services/peopleService';

/** Shown when a submodule is `locked` — a higher plan unlocks it. */
const UpgradeLocked = () => {
    const navigate = useNavigate();
    return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
            <h2 className="text-lg font-bold text-slate-300">This feature is part of a higher plan</h2>
            <p className="text-slate-500 text-sm max-w-md">Upgrade your plan to unlock it.</p>
            <button
                type="button"
                onClick={() => navigate('/org/billing')}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
                Upgrade plan
            </button>
        </div>
    );
};

/** Shown when a submodule is `disabled`/`hidden` — turned off, no upgrade path. */
const FeatureUnavailable = () => (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center px-4">
        <h2 className="text-lg font-bold text-slate-300">Feature Not Available</h2>
        <p className="text-slate-500 text-sm max-w-md">This feature is not available for your organization. Contact your administrator.</p>
    </div>
);

/**
 * Feature-gated route wrapper on the resolved 5-state model via the shared FeatureRoute:
 * enabled→render · read_only→inert · locked→upgrade prompt · disabled/hidden→unavailable.
 * Fail-open to enabled while shell context is resolving.
 */
const FeatureGate = ({ flagKey, children }: { flagKey: string; children: React.ReactNode }) => {
    const shell = useShellBridge();
    const state = shell?.getFeatureState ? shell.getFeatureState(flagKey) : 'enabled';
    return (
        <FeatureRoute
            state={state}
            loading={(shell?.effectiveFlagsLoaded === false)}
            hiddenFallback={<FeatureUnavailable />}
            lockedFallback={<UpgradeLocked />}
            disabledFallback={<FeatureUnavailable />}
        >
            {children}
        </FeatureRoute>
    );
};

// Guards a route on the signed-in user's ROLE PERMISSIONS — the page-level
// counterpart to FeatureGate. A plan flag answers "is this feature in the plan";
// this answers "may this user open it". Both must pass, so the two compose
// rather than replace one another.
//
// Fail-closed: while entitlements resolve (or with no bridge at all) the page is
// withheld rather than flashed. Denial renders an explanatory notice instead of
// a blank screen so "not allowed" is distinguishable from "broken". Codes are
// wildcard-aware via the shell bridge, matching the backend resolver exactly.
const PermissionGuard = ({ permission, children }: { permission: string | string[]; children: React.ReactNode }) => {
    const shell = useShellBridge();
    if (!shell || !shell.permissionsLoaded) return null;
    const codes = Array.isArray(permission) ? permission : [permission];
    const allowed = shell.hasAnyPermission
        ? shell.hasAnyPermission(...codes)
        : codes.some((c: string) => shell.hasPermission?.(c) ?? false);
    if (allowed) return <>{children}</>;
    return (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">You don&apos;t have access to this page</h2>
            <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
                Your role doesn&apos;t include permission for this page. Ask an administrator if you need it.
            </p>
        </div>
    );
};

// Shell Context Synchronizer
const PeopleShellInitializer =({ children }: { children: React.ReactNode }) => {
    const shell = useShellBridge();
    const [isSynced, setIsSynced] = React.useState(false);

    // Keep the freshest access token in a ref and resolve it live on every API
    // request. The shell rotates short-lived Supabase JWTs; previously the token
    // was cached once and never refreshed, so requests made after a rotation
    // failed with 401 "Invalid or expired token" (e.g. editing a department or
    // opening the Utilization page later in the session).
    const tokenRef = React.useRef<string | undefined>(shell?.accessToken);
    tokenRef.current = shell?.accessToken;

    useEffect(() => {
        peopleService.setAccessTokenProvider(() => tokenRef.current ?? '');
        return () => peopleService.setAccessTokenProvider(null);
    }, []);

    useEffect(() => {
        if (shell?.currentTenant?.id && shell?.currentOrg?.id) {
            console.log('People Connect MFE: Syncing context from shell:', {
                tenant: shell.currentTenant.id,
                org: shell.currentOrg.id,
            });

            peopleService.setTenantId(shell.currentTenant.id);
            peopleService.setOrgId(shell.currentOrg.id);

            if (shell.accessToken) {
                peopleService.setAccessToken(shell.accessToken);
            }

            if (shell.user) {
                peopleService.setUser({
                    id: shell.user.id,
                    email: shell.user.email,
                    full_name: shell.user.full_name || shell.user.name || 'Unknown',
                });
            }

            setIsSynced(true);
        }
    }, [shell?.currentTenant?.id, shell?.currentOrg?.id, shell?.accessToken, shell?.user]);

    if (!isSynced) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-4">
                <div className="w-8 h-8 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
                <p className="text-sm font-medium animate-pulse">Connecting to shell context...</p>
            </div>
        );
    }

    return <>{children}</>;
};

// Lazy-loaded pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MyHomePage = lazy(() => import('./pages/my/MyHomePage'));
const MyLeavePage = lazy(() => import('./pages/my/MyLeavePage'));
const MyTimePage = lazy(() => import('./pages/my/MyTimePage'));
const MyGoalsPage = lazy(() => import('./pages/my/MyGoalsPage'));
const MyProfilePage = lazy(() => import('./pages/my/MyProfilePage'));
const MyTeamPage = lazy(() => import('./pages/my/MyTeamPage'));
const PeoplePage = lazy(() => import('./pages/PeoplePage'));
const PersonDetailPage = lazy(() => import('./pages/PersonDetailPage'));
const AllocationsPage = lazy(() => import('./pages/AllocationsPage'));
const AttendanceRegisterPage = lazy(() => import('./pages/AttendanceRegisterPage'));
const EmployeeTimesheetsPage = lazy(() => import('./pages/EmployeeTimesheetsPage'));
const UtilizationPage = lazy(() => import('./pages/UtilizationPage'));
// New page imports
const DepartmentsPage = lazy(() => import('./pages/DepartmentsPage'));
const DepartmentDetailPage = lazy(() => import('./pages/DepartmentDetailPage'));
const LeaveTypesPage = lazy(() => import('./pages/LeaveTypesPage'));
const LeaveRequestsPage = lazy(() => import('./pages/LeaveRequestsPage'));
const LeaveCalendarPage = lazy(() => import('./pages/LeaveCalendarPage'));
const LeaveApprovalsPage = lazy(() => import('./pages/LeaveApprovalsPage'));
const LeaveBalancesPage = lazy(() => import('./pages/LeaveBalancesPage'));
const ReviewTemplatesPage = lazy(() => import('./pages/ReviewTemplatesPage'));
const PerformanceReviewsPage = lazy(() => import('./pages/PerformanceReviewsPage'));
const ReviewDetailPage = lazy(() => import('./pages/ReviewDetailPage'));
const GoalsPage = lazy(() => import('./pages/GoalsPage'));
const TeamPerformancePage = lazy(() => import('./pages/TeamPerformancePage'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const ImportExportPage = lazy(() => import('./pages/ImportExportPage'));
const WorkLocationsPage = lazy(() => import('./pages/WorkLocationsPage'));
const HolidaysPage = lazy(() => import('./pages/HolidaysPage'));
const ShiftsPage = lazy(() => import('./pages/ShiftsPage'));
const ApprovalChainsPage = lazy(() => import('./pages/settings/ApprovalChainsPage'));
const EmploymentPolicyPage = lazy(() => import('./pages/settings/EmploymentPolicyPage'));
const DesignationsPage = lazy(() => import('./pages/masters/DesignationsPage'));
const EmploymentTypesPage = lazy(() => import('./pages/masters/EmploymentTypesPage'));
const SkillsPage = lazy(() => import('./pages/masters/SkillsPage'));
const LaborCategoriesPage = lazy(() => import('./pages/masters/LaborCategoriesPage'));
const EmployeeStatusPage = lazy(() => import('./pages/masters/EmployeeStatusPage'));
const DocumentTypesPage = lazy(() => import('./pages/masters/DocumentTypesPage'));
const SettingsHubPage = lazy(() => import('./pages/SettingsHubPage'));
const OrganizationSettingsPage = lazy(() => import('./pages/settings/OrganizationSettingsPage'));
const AttendanceSettingsPage = lazy(() => import('./pages/settings/AttendanceSettingsPage'));
const NumberingSettingsPage = lazy(() => import('./pages/settings/NumberingSettingsPage'));
const LeaveSettingsPage = lazy(() => import('./pages/settings/LeaveSettingsPage'));
const ResourceAllocationSettingsPage = lazy(() => import('./pages/settings/ResourceAllocationSettingsPage'));
const PerformanceSettingsPage = lazy(() => import('./pages/settings/PerformanceSettingsPage'));
const NotificationSettingsPage = lazy(() => import('./pages/settings/NotificationSettingsPage'));
const UtilizationSettingsPage = lazy(() => import('./pages/settings/UtilizationSettingsPage'));
const TimesheetSettingsPage = lazy(() => import('./pages/settings/TimesheetSettingsPage'));
const CustomFieldsPage = lazy(() => import('./pages/settings/CustomFieldsPage'));

const Layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="flex h-full bg-slate-950 text-slate-100">
            <main className="flex-1 overflow-auto">
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center min-h-[300px]">
                            <div className="w-6 h-6 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
                        </div>
                    }
                >
                    {children}
                </Suspense>
            </main>
        </div>
    );
};

/**
 * Where the module opens depends on who you are.
 *
 * The admin Dashboard is a workforce overview — for someone without
 * `employees.read` it is an empty or near-empty page, and it was the first
 * thing every employee saw. They get My Work instead; administrators are
 * unaffected.
 *
 * Falls back to the dashboard while entitlements resolve rather than guessing,
 * so a slow permission fetch cannot bounce an admin into the employee view.
 */
const ModuleLanding: React.FC = () => {
    const shell = useShellBridge() as any;

    if (shell && shell.permissionsLoaded === false) return null;

    const isAdminViewer = shell?.hasPermission?.('employees.read')
        || shell?.hasPermission?.('departments.read')
        || shell?.hasPermission?.('*');

    return <Navigate to={isAdminViewer ? 'dashboard' : 'my'} replace />;
};

const App = () => {
    return (
        <Layout>
            <PeopleShellInitializer>
                <Routes>
                    <Route path="/" element={<ModuleLanding />} />
                    <Route path="dashboard" element={<DashboardPage />} />

                    {/* Employee self-service. Deliberately permission-free: these
                        routes show only the caller's own records (the backend
                        resolves the person from the session), so requiring an
                        administrator's read permission here is exactly the
                        inversion that left employees with no usable surface.
                        They ARE plan-gated: submodule:people:self_service is the
                        tier switch for the whole surface (mirrored class-level on
                        the /me controller); per-domain flags (leave_requests,
                        job_sessions, …) continue to govern the data inside. */}
                    <Route path="my" element={<FeatureGate flagKey="submodule:people:self_service"><MyHomePage /></FeatureGate>} />
                    <Route path="my/leave" element={<FeatureGate flagKey="submodule:people:self_service"><MyLeavePage /></FeatureGate>} />
                    <Route path="my/time" element={<FeatureGate flagKey="submodule:people:self_service"><MyTimePage /></FeatureGate>} />
                    <Route path="my/goals" element={<FeatureGate flagKey="submodule:people:self_service"><MyGoalsPage /></FeatureGate>} />
                    <Route path="my/profile" element={<FeatureGate flagKey="submodule:people:self_service"><MyProfilePage /></FeatureGate>} />
                    <Route path="my/team" element={<FeatureGate flagKey="submodule:people:self_service"><MyTeamPage /></FeatureGate>} />

                    {/* People */}
                    <Route path="people" element={<PermissionGuard permission="employees.read"><PeoplePage /></PermissionGuard>} />
                    <Route path="people/:id" element={<PermissionGuard permission="employees.read"><PersonDetailPage /></PermissionGuard>} />

                    {/* Departments */}
                    <Route path="departments" element={<PermissionGuard permission="departments.read"><DepartmentsPage /></PermissionGuard>} />
                    <Route path="departments/:id" element={<PermissionGuard permission="departments.read"><DepartmentDetailPage /></PermissionGuard>} />

                    {/* Allocations & Time */}
                    <Route path="allocations" element={<PermissionGuard permission="allocations.read"><FeatureGate flagKey="submodule:people:allocations"><AllocationsPage /></FeatureGate></PermissionGuard>} />
                    <Route path="attendance" element={<PermissionGuard permission="attendance.read"><FeatureGate flagKey="submodule:people:attendance"><AttendanceRegisterPage /></FeatureGate></PermissionGuard>} />
                    {/* Read-only Employee Timesheets (time logging lives in the Timesheets module) */}
                    <Route path="time" element={<PermissionGuard permission="attendance.read"><EmployeeTimesheetsPage /></PermissionGuard>} />
                    <Route path="utilization" element={<PermissionGuard permission="utilization.read"><FeatureGate flagKey="submodule:people:utilization"><UtilizationPage /></FeatureGate></PermissionGuard>} />

                    {/* Leave Management */}
                    <Route path="leaves/types" element={<PermissionGuard permission="leave.configure"><LeaveTypesPage /></PermissionGuard>} />
                    <Route path="leaves/requests" element={<PermissionGuard permission={['leave.read', 'leave.request']}><LeaveRequestsPage /></PermissionGuard>} />
                    <Route path="leaves/calendar" element={<PermissionGuard permission="leave.read"><LeaveCalendarPage /></PermissionGuard>} />
                    <Route path="leaves/approvals" element={<PermissionGuard permission="leave.approve"><LeaveApprovalsPage /></PermissionGuard>} />
                    <Route path="leaves/balances" element={<PermissionGuard permission="leave.read"><LeaveBalancesPage /></PermissionGuard>} />

                    {/* Performance Reviews */}
                    <Route path="reviews/templates" element={<PermissionGuard permission="reviews.create"><FeatureGate flagKey="submodule:people:reviews"><ReviewTemplatesPage /></FeatureGate></PermissionGuard>} />
                    <Route path="reviews" element={<PermissionGuard permission="reviews.read"><FeatureGate flagKey="submodule:people:reviews"><PerformanceReviewsPage /></FeatureGate></PermissionGuard>} />
                    <Route path="reviews/:id" element={<PermissionGuard permission="reviews.read"><FeatureGate flagKey="submodule:people:reviews"><ReviewDetailPage /></FeatureGate></PermissionGuard>} />

                    {/* Goals & Performance */}
                    <Route path="goals" element={<PermissionGuard permission="goals.read"><GoalsPage /></PermissionGuard>} />
                    <Route path="team-performance" element={<PermissionGuard permission={['reviews.read', 'utilization.read']}><TeamPerformancePage /></PermissionGuard>} />
                    <Route path="feedback" element={<PermissionGuard permission="feedback.read"><FeedbackPage /></PermissionGuard>} />

                    {/* Settings — every screen here writes org-wide policy, so they all sit behind org_policy.read */}
                    <Route path="settings" element={<PermissionGuard permission="org_policy.read"><SettingsHubPage /></PermissionGuard>} />
                    <Route path="settings/organization" element={<PermissionGuard permission="org_policy.read"><OrganizationSettingsPage /></PermissionGuard>} />
                    <Route path="settings/attendance" element={<PermissionGuard permission="org_policy.read"><AttendanceSettingsPage /></PermissionGuard>} />
                    <Route path="settings/numbering" element={<PermissionGuard permission="org_policy.read"><NumberingSettingsPage /></PermissionGuard>} />
                    <Route path="settings/leave-configuration" element={<PermissionGuard permission="leave.configure"><LeaveSettingsPage /></PermissionGuard>} />
                    <Route path="settings/resource-allocation" element={<PermissionGuard permission="org_policy.read"><ResourceAllocationSettingsPage /></PermissionGuard>} />
                    <Route path="settings/performance" element={<PermissionGuard permission="org_policy.read"><PerformanceSettingsPage /></PermissionGuard>} />
                    <Route path="settings/notifications" element={<PermissionGuard permission="org_policy.read"><NotificationSettingsPage /></PermissionGuard>} />
                    <Route path="settings/utilization-settings" element={<PermissionGuard permission="org_policy.read"><UtilizationSettingsPage /></PermissionGuard>} />
                    <Route path="settings/timesheet-settings" element={<PermissionGuard permission="org_policy.read"><TimesheetSettingsPage /></PermissionGuard>} />
                    {/* Guarded on employees.read to match the backend, which enforces
                        PEOPLE_PERMISSIONS.EMPLOYEES.* on /locations. org_policy.read
                        let through users the API would then reject. */}
                    <Route path="settings/work-locations" element={<PermissionGuard permission="employees.read"><WorkLocationsPage /></PermissionGuard>} />
                    <Route path="settings/holidays" element={<PermissionGuard permission="org_policy.read"><FeatureGate flagKey="submodule:people:holidays"><HolidaysPage /></FeatureGate></PermissionGuard>} />
                    <Route path="settings/shifts" element={<PermissionGuard permission="org_policy.read"><FeatureGate flagKey="submodule:people:shifts"><ShiftsPage /></FeatureGate></PermissionGuard>} />
                    <Route path="settings/approval-chains" element={<PermissionGuard permission="org_policy.read"><FeatureGate flagKey="submodule:people:approval_chains"><ApprovalChainsPage /></FeatureGate></PermissionGuard>} />
                    <Route path="settings/employment-policy" element={<PermissionGuard permission="org_policy.read"><FeatureGate flagKey="submodule:people:employment_policy"><EmploymentPolicyPage /></FeatureGate></PermissionGuard>} />

                    {/* Master Data — Designations, Employment Types, Skills, Employee Status, Document Types. */}
                    <Route path="settings/designations" element={<PermissionGuard permission="org_policy.read"><FeatureGate flagKey="submodule:people:masters"><DesignationsPage /></FeatureGate></PermissionGuard>} />
                    <Route path="settings/employment-types" element={<PermissionGuard permission="org_policy.read"><FeatureGate flagKey="submodule:people:masters"><EmploymentTypesPage /></FeatureGate></PermissionGuard>} />
                    <Route path="settings/skills" element={<PermissionGuard permission="org_policy.read"><FeatureGate flagKey="submodule:people:masters"><SkillsPage /></FeatureGate></PermissionGuard>} />
                    <Route path="settings/labor-categories" element={<PermissionGuard permission="org_policy.read"><FeatureGate flagKey="submodule:people:labor_categories"><LaborCategoriesPage /></FeatureGate></PermissionGuard>} />
                    <Route path="settings/employee-status" element={<PermissionGuard permission="org_policy.read"><FeatureGate flagKey="submodule:people:masters"><EmployeeStatusPage /></FeatureGate></PermissionGuard>} />
                    <Route path="settings/document-types" element={<PermissionGuard permission="org_policy.read"><FeatureGate flagKey="submodule:people:masters"><DocumentTypesPage /></FeatureGate></PermissionGuard>} />
                    <Route path="settings/custom-fields" element={<PermissionGuard permission="org_policy.read"><FeatureGate flagKey="submodule:people:employee_custom_fields"><CustomFieldsPage /></FeatureGate></PermissionGuard>} />

                    {/* Import/Export */}
                    <Route path="import-export" element={<PermissionGuard permission="employees.import"><ImportExportPage /></PermissionGuard>} />


                </Routes>
            </PeopleShellInitializer>
        </Layout>
    );
};

export default App;

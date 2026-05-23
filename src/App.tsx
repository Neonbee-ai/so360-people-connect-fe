import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useShellBridge } from '@so360/shell-context';
import { peopleService } from './services/peopleService';

/** Feature-gated route wrapper for people-connect submodules (fail-open). */
const FeatureGate = ({ flagKey, children }: { flagKey: string; children: React.ReactNode }) => {
    const shell = useShellBridge();
    const enabled = shell?.isFeatureEnabled?.(flagKey) ?? true;
    if (!enabled) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center px-4">
                <div className="text-slate-600 text-4xl">&#128274;</div>
                <h2 className="text-lg font-bold text-slate-300">Feature Not Available</h2>
                <p className="text-slate-500 text-sm max-w-md">This feature is not included in your current plan. Contact your administrator to upgrade.</p>
            </div>
        );
    }
    return <>{children}</>;
};

// Shell Context Synchronizer
const PeopleShellInitializer = ({ children }: { children: React.ReactNode }) => {
    const shell = useShellBridge();
    const [isSynced, setIsSynced] = React.useState(false);

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
    }, [shell?.currentTenant?.id, shell?.currentOrg?.id, shell?.user]);

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
const PeoplePage = lazy(() => import('./pages/PeoplePage'));
const PersonDetailPage = lazy(() => import('./pages/PersonDetailPage'));
const AllocationsPage = lazy(() => import('./pages/AllocationsPage'));
const TimeEntriesPage = lazy(() => import('./pages/TimeEntriesPage'));
const UtilizationPage = lazy(() => import('./pages/UtilizationPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));

// New page imports
const DepartmentsPage = lazy(() => import('./pages/DepartmentsPage'));
const LeaveTypesPage = lazy(() => import('./pages/LeaveTypesPage'));
const LeaveRequestsPage = lazy(() => import('./pages/LeaveRequestsPage'));
const LeaveCalendarPage = lazy(() => import('./pages/LeaveCalendarPage'));
const LeaveApprovalsPage = lazy(() => import('./pages/LeaveApprovalsPage'));
const ReviewTemplatesPage = lazy(() => import('./pages/ReviewTemplatesPage'));
const PerformanceReviewsPage = lazy(() => import('./pages/PerformanceReviewsPage'));
const ReviewDetailPage = lazy(() => import('./pages/ReviewDetailPage'));
const GoalsPage = lazy(() => import('./pages/GoalsPage'));
const TeamPerformancePage = lazy(() => import('./pages/TeamPerformancePage'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const ImportExportPage = lazy(() => import('./pages/ImportExportPage'));
const WorkLocationsPage = lazy(() => import('./pages/WorkLocationsPage'));

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

const App = () => {
    return (
        <Layout>
            <PeopleShellInitializer>
                <Routes>
                    <Route path="/" element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />

                    {/* People */}
                    <Route path="people" element={<PeoplePage />} />
                    <Route path="people/:id" element={<PersonDetailPage />} />

                    {/* Departments */}
                    <Route path="departments" element={<DepartmentsPage />} />

                    {/* Allocations & Time */}
                    <Route path="allocations" element={<FeatureGate flagKey="submodule:people:allocations"><AllocationsPage /></FeatureGate>} />
                    <Route path="time" element={<TimeEntriesPage />} />
                    <Route path="utilization" element={<FeatureGate flagKey="submodule:people:utilization"><UtilizationPage /></FeatureGate>} />

                    {/* Leave Management */}
                    <Route path="leaves/types" element={<LeaveTypesPage />} />
                    <Route path="leaves/requests" element={<LeaveRequestsPage />} />
                    <Route path="leaves/calendar" element={<LeaveCalendarPage />} />
                    <Route path="leaves/approvals" element={<LeaveApprovalsPage />} />

                    {/* Performance Reviews */}
                    <Route path="reviews/templates" element={<FeatureGate flagKey="submodule:people:reviews"><ReviewTemplatesPage /></FeatureGate>} />
                    <Route path="reviews" element={<FeatureGate flagKey="submodule:people:reviews"><PerformanceReviewsPage /></FeatureGate>} />
                    <Route path="reviews/:id" element={<FeatureGate flagKey="submodule:people:reviews"><ReviewDetailPage /></FeatureGate>} />

                    {/* Goals & Performance */}
                    <Route path="goals" element={<GoalsPage />} />
                    <Route path="team-performance" element={<TeamPerformancePage />} />
                    <Route path="feedback" element={<FeedbackPage />} />

                    {/* Settings */}
                    <Route path="settings/work-locations" element={<WorkLocationsPage />} />

                    {/* Import/Export */}
                    <Route path="import-export" element={<ImportExportPage />} />

                    {/* Events */}
                    <Route path="events" element={<EventsPage />} />
                </Routes>
            </PeopleShellInitializer>
        </Layout>
    );
};

export default App;

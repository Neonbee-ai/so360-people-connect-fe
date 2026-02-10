import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ShellContext } from '@so360/shell-context';
import { peopleService } from './services/peopleService';
import ModuleNav from './components/ModuleNav';

// Shell Context Synchronizer
const PeopleShellInitializer = ({ children }: { children: React.ReactNode }) => {
    const shell = React.useContext(ShellContext);
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

const Layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <ModuleNav />
            <main className="w-full">
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
                    <Route path="people" element={<PeoplePage />} />
                    <Route path="people/:id" element={<PersonDetailPage />} />
                    <Route path="allocations" element={<AllocationsPage />} />
                    <Route path="time" element={<TimeEntriesPage />} />
                    <Route path="utilization" element={<UtilizationPage />} />
                    <Route path="events" element={<EventsPage />} />
                </Routes>
            </PeopleShellInitializer>
        </Layout>
    );
};

export default App;

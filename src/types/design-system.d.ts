import React from 'react';

declare module '@so360/design-system' {
    export interface QuotaBarProps {
        label: string;
        icon?: React.ReactNode;
        used: number;
        limit: number;
        unit?: string;
        isUnlimited?: boolean;
        showBuyMore?: boolean;
        onBuyMore?: () => void;
        className?: string;
    }
    export const QuotaBar: React.FC<QuotaBarProps>;

    export interface QuotaGateProps {
        quotaKey: string;
        moduleCode: string;
        used: number;
        limit: number;
        isUnlimited?: boolean;
        disableOnExceeded?: boolean;
        fallback?: React.ReactNode;
        children: React.ReactNode;
    }
    export const QuotaGate: React.FC<QuotaGateProps>;

    export type FeatureState = 'enabled' | 'read_only' | 'locked' | 'disabled' | 'hidden';
    export interface FeatureRouteProps {
        state: FeatureState;
        children: React.ReactNode;
        hiddenFallback?: React.ReactNode;
        lockedFallback?: React.ReactNode;
        disabledFallback?: React.ReactNode;
    }
    export const FeatureRoute: React.FC<FeatureRouteProps>;

    // Universal toast surface (design-system feedback primitives)
    export type ToastVariant = 'success' | 'error' | 'warning' | 'info';
    export interface ToastAction {
        label: string;
        onClick: () => void;
    }
    export interface ToastOptions {
        title?: string;
        duration?: number;
        sticky?: boolean;
        id?: string;
        action?: ToastAction;
    }
    export interface ToastPromiseMessages<T> {
        loading?: string;
        success: string | ((value: T) => string);
        error?: string | ((err: unknown) => string);
    }
    export interface ToastApi {
        success(message: string, opts?: ToastOptions): string;
        error(message: string, opts?: ToastOptions): string;
        warning(message: string, opts?: ToastOptions): string;
        info(message: string, opts?: ToastOptions): string;
        promise<T>(p: Promise<T>, msgs: ToastPromiseMessages<T>): Promise<T>;
        dismiss(id?: string): void;
    }
    export const toast: ToastApi;
    export function useToast(): ToastApi;
    export function getErrorMessage(err: unknown, fallback?: string): string;
    export function attachToastErrorHandler(instance: unknown, options?: unknown): number;
    export const toastBus: {
        subscribe(listener: unknown): () => void;
        show(...args: unknown[]): string;
        dismiss(id?: string): void;
        getToasts(): unknown[];
    };
    export const ToastViewport: React.FC;
    export const ToastProvider: React.FC<{ children?: React.ReactNode }>;

    // Inline status banner. Mirror any change here in the real component at
    // so360-shell-fe/packages/design-system/src/components/Alert.tsx — this
    // ambient declaration shadows the package's own types for this app.
    export type AlertVariant = 'info' | 'success' | 'warning' | 'error';
    export interface AlertAction {
        label: string;
        onClick: () => void;
    }
    export interface AlertProps {
        variant?: AlertVariant;
        title?: string;
        children?: React.ReactNode;
        icon?: React.ComponentType<{ className?: string }> | false;
        action?: AlertAction;
        onDismiss?: () => void;
        className?: string;
        id?: string;
    }
    export const Alert: React.FC<AlertProps>;

    // Right-hand slide-over — the platform's primary create/edit surface.
    // Mirror of so360-shell-fe/packages/design-system/src/components/Drawer.tsx.
    export interface DrawerProps {
        isOpen: boolean;
        onClose: () => void;
        title: string;
        subtitle?: string;
        size?: 'sm' | 'md' | 'lg';
        footer?: React.ReactNode;
        onBack?: () => void;
        children: React.ReactNode;
    }
    export const Drawer: React.FC<DrawerProps>;

    // Standard master-data table. Mirror of
    // so360-shell-fe/packages/design-system/src/components/DataTable.tsx.
    export interface DataTableColumn<T> {
        key: string;
        header: string;
        render?: (row: T) => React.ReactNode;
        widthClassName?: string;
    }
    export interface DataTableProps<T> {
        columns: DataTableColumn<T>[];
        rows: T[];
        rowKey: (row: T) => string;
        loading?: boolean;
        emptyState?: React.ReactNode;
        onRowClick?: (row: T) => void;
        skeletonRows?: number;
    }
    export function DataTable<T>(props: DataTableProps<T>): React.ReactElement;

    // Mirror of design-system DeleteConfirmDialog.
    export interface DeleteConfirmDialogProps {
        isOpen: boolean;
        onClose: () => void;
        onConfirm: () => void;
        title?: string;
        message?: string;
        entityName?: string;
        entityType?: string;
        confirmText?: string;
        cancelText?: string;
        isLoading?: boolean;
        variant?: 'danger' | 'warning';
    }
    export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps>;
}

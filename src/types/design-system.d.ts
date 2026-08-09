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
}

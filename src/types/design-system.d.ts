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
}

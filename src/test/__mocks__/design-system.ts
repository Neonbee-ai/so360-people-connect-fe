import React from 'react';
export const Button = (props: any) => props;
export const Input = (props: any) => props;
export const Select = (props: any) => props;
export const Modal = (props: any) => props;
export const Card = (props: any) => props;
export const Badge = (props: any) => props;
export const Spinner = (props: any) => props;
export const Tooltip = (props: any) => props;
export const QuotaGate = ({ children }: any) => React.createElement(React.Fragment, null, children);
export const QuotaBar = () => null;
export const Pagination = () => null;
export const DeleteConfirmDialog = () => null;

// Universal toast facade (shell owns the single global viewport).
export const toast = {
    success: (_message: string, _opts?: any) => 'toast-id',
    error: (_message: string, _opts?: any) => 'toast-id',
    warning: (_message: string, _opts?: any) => 'toast-id',
    info: (_message: string, _opts?: any) => 'toast-id',
    promise: <T,>(p: Promise<T>, _msgs?: any) => p,
    dismiss: (_id?: string) => undefined,
};
export const useToast = () => toast;
export const getErrorMessage = (_err: unknown, fallback?: string) => fallback ?? 'error';
export const attachToastErrorHandler = () => 0;
export const toastBus = {
    show: () => undefined,
    dismiss: () => undefined,
    subscribe: () => () => undefined,
    getToasts: () => [],
};

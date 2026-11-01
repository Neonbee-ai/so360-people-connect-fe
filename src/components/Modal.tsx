import React from 'react';
import { Modal as CombModal } from '@so360/design-system';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    /** Rendered in the Comb Modal footer slot. */
    footer?: React.ReactNode;
    /** Alias of `footer` (legacy call sites). `footer` wins when both are given. */
    actions?: React.ReactNode;
}

/** Thin adapter: keeps the legacy `isOpen` API while rendering the Comb Modal. Size passes 1:1 (md 512, lg 640, xl 800). */
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', footer, actions }) => (
    <CombModal open={isOpen} onClose={onClose} title={title} size={size} footer={footer ?? actions}>
        {children}
    </CombModal>
);

export default Modal;

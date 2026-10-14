import React from 'react';
import { Modal as CombModal } from '@so360/design-system';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

/** Thin adapter: keeps the legacy `isOpen` API while rendering the Comb Modal. */
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => (
    <CombModal open={isOpen} onClose={onClose} title={title} size={size}>
        {children}
    </CombModal>
);

export default Modal;

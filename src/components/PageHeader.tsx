import React from 'react';
import { PageHeader as CombPageHeader } from '@so360/design-system';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
}

/** Thin adapter: keeps the legacy `subtitle` API while rendering the Comb PageHeader. */
const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => (
    <CombPageHeader title={title} description={subtitle} actions={actions} />
);

export default PageHeader;

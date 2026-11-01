import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button, Cluster, EmptyState as CombEmptyState } from '@so360/design-system';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
    /**
     * Optional lower-emphasis alternative rendered beside `action`, for empty
     * states with two honest next steps (e.g. "use a standard template" vs
     * "build your own"). Ignored unless `action` is also set — a lone secondary
     * button would just be a primary one wearing the wrong style.
     */
    secondaryAction?: { label: string; onClick: () => void };
}

/** Thin adapter over the Comb EmptyState; keeps the legacy props (incl. `secondaryAction`). */
const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, secondaryAction }) => (
    <>
        <CombEmptyState icon={icon} title={title} description={description} action={action} />
        {action && secondaryAction && (
            <Cluster>
                <Button variant="secondary" onClick={secondaryAction.onClick}>
                    {secondaryAction.label}
                </Button>
            </Cluster>
        )}
    </>
);

export default EmptyState;

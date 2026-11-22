import React from 'react';
import { Lock, LucideIcon } from 'lucide-react';
import EmptyState from './EmptyState';

/** HTTP status carried by apiClient errors (`Object.assign(new Error(), { status })`). */
export const errorStatus = (err: unknown): number | undefined => {
  const s = (err as { status?: unknown } | null | undefined)?.status;
  return typeof s === 'number' ? s : undefined;
};

/** 403 = the API refused this user: a permission state, never a load failure or toast. */
export const isForbidden = (err: unknown): boolean => errorStatus(err) === 403;

interface ListLoadFailedProps {
  /** The error the list load threw. */
  error: unknown;
  /** Plural list name, e.g. "Designations". */
  plural: string;
  icon: LucideIcon;
  onRetry: () => void;
}

/**
 * Settings-list load outcome when the fetch failed. Comb feedback states:
 * permission denied = lock + "Ask an admin" (no 403 text); load failed =
 * message + Retry. Neither shows generic "something went wrong" copy, which
 * reads as a crashed page.
 */
const ListLoadFailed: React.FC<ListLoadFailedProps> = ({ error, plural, icon, onRetry }) => {
  const name = plural.toLowerCase();
  if (isForbidden(error)) {
    return (
      <EmptyState
        icon={Lock}
        title={`You don't have access to ${name}`}
        description="Ask an admin to give your role People access."
      />
    );
  }
  return (
    <EmptyState
      icon={icon}
      title={`Couldn't load ${name}`}
      description="Check your connection and try again."
      action={{ label: 'Retry', onClick: onRetry }}
    />
  );
};

export default ListLoadFailed;

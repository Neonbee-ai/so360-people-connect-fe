import React from 'react';
import { type Person } from './PeopleSelector';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export interface TaskItem {
    id: string;
    title: string;
    done: boolean;
    assignee?: Person | null;
    /** ISO date 'YYYY-MM-DD'. */
    dueDate?: string | null;
    priority?: TaskPriority;
}
export type TaskPatch = Partial<Pick<TaskItem, 'title' | 'assignee' | 'dueDate' | 'priority'>>;
type MaybePromise = void | Promise<unknown>;
export interface TaskListProps {
    tasks: TaskItem[];
    /** Callbacks may return a Promise: the row shows pending and reverts if it rejects. */
    onAdd?: (title: string) => MaybePromise;
    onToggle?: (id: string, done: boolean) => MaybePromise;
    onUpdate?: (id: string, patch: TaskPatch) => MaybePromise;
    onDelete?: (id: string) => MaybePromise;
    /** Assignee choices for the inline PeopleSelector. */
    people?: Person[];
    /** Alternative async source for assignee choices. */
    loadPeople?: () => Promise<Person[]>;
    /** "Now" for overdue / due-today. Default: the current time. */
    now?: Date;
    readOnly?: boolean;
    loading?: boolean;
    /** Shown instead of the list when the load failed. */
    error?: string;
    onRetry?: () => void;
    emptyText?: string;
    name?: string;
}
export type DueState = 'overdue' | 'today' | 'later';
/** Compare a due date to `now` (calendar days in the runtime zone). */
export declare function dueState(dueDate: string, now: Date): DueState;
export declare const TaskList: React.FC<TaskListProps>;
export {};

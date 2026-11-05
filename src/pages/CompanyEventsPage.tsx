import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Plus, Edit2, Trash2, Ban } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import {
  toast, Drawer, DataTable, DeleteConfirmDialog, type DataTableColumn, Select, SegmentedControl,
  Badge, Banner, Button, Checkbox, Cluster, IconButton, ListPageTemplate, Stack, Switch, TextField, Textarea,
  DateInput, DateTimePicker,
} from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { formatDate, formatDateTime } from '@so360/formatters';
import {
  companyEventsApi, type CompanyEvent, type CompanyEventPayload, type CompanyEventType,
  type CompanyEventAudience, type RsvpResponse,
} from '../services/companyEventsService';
import { departmentsApi, type Department } from '../services/departmentsService';
import { isoToWallTime, wallTimeToIso } from '../utils/zonedTime';

// Company events (Pulse 59ea1731). Everyone with company_events.read sees the
// events addressed to them and RSVPs; company_events.create adds events and
// manages their own; update/delete/manage act on any event. The server
// enforces all of it — this page only hides what the API says is not allowed.

export const EVENT_TYPE_OPTIONS: { value: CompanyEventType; label: string; tone: 'primary' | 'success' | 'warning' | 'neutral' }[] = [
  { value: 'meeting', label: 'Meeting', tone: 'neutral' },
  { value: 'town_hall', label: 'Town hall', tone: 'primary' },
  { value: 'training', label: 'Training', tone: 'warning' },
  { value: 'celebration', label: 'Celebration', tone: 'success' },
  { value: 'social', label: 'Social', tone: 'success' },
  { value: 'other', label: 'Other', tone: 'neutral' },
];

const RSVP_OPTIONS: { value: RsvpResponse; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'declined', label: "Can't go" },
];

type When = 'upcoming' | 'past';

const CompanyEventsPage: React.FC = () => {
  const { settings } = useBusinessSettings();
  const orgTz = settings?.timezone || 'UTC';
  const locale = settings?.document_language || 'en-US';

  const [when, setWhen] = useState<When>('upcoming');
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState<CompanyEvent | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CompanyEvent | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [rsvpBusy, setRsvpBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Cancelled events stay listed (with a badge) so invitees learn about it.
      const result = await companyEventsApi.getAll({ when, include_cancelled: 'true' });
      setEvents(result?.data ?? []);
      setCanCreate(!!result?.permissions?.can_create);
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [when]);

  useEffect(() => { load(); }, [load]);

  // Department names for the audience column + picker. Best effort: a caller
  // without departments access still gets a working events page.
  useEffect(() => {
    departmentsApi.getAll({ is_active: true, limit: 500 })
      .then(r => setDepartments(r?.data ?? []))
      .catch(() => setDepartments([]));
  }, []);

  const closeDrawer = () => { setShowDrawer(false); setEditing(null); };

  const handleSave = async (payload: CompanyEventPayload) => {
    try {
      if (editing) {
        await companyEventsApi.update(editing.id, payload);
        toast.success('Event updated');
      } else {
        await companyEventsApi.create(payload);
        toast.success(`Event "${payload.title}" created`);
      }
      closeDrawer();
      load();
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to save event');
    }
  };

  const handleCancelEvent = async (ev: CompanyEvent) => {
    try {
      await companyEventsApi.cancel(ev.id);
      toast.success('Event cancelled');
      load();
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to cancel event');
    }
  };

  const handleRsvp = async (ev: CompanyEvent, response: RsvpResponse) => {
    setRsvpBusy(ev.id);
    try {
      await companyEventsApi.rsvp(ev.id, response);
      load();
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to save your response');
    } finally {
      setRsvpBusy(null);
    }
  };

  const handleDeleteConfirmed = async (ev: CompanyEvent) => {
    setDeleteBusy(true);
    try {
      const result = await companyEventsApi.delete(ev.id);
      toast.success(result?.message || 'Event deleted');
      load();
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to delete event');
    } finally {
      setDeleteBusy(false);
      setConfirmDelete(null);
    }
  };

  const formatWhen = (ev: CompanyEvent) => {
    const tz = ev.timezone || orgTz;
    if (ev.all_day) {
      const start = formatDate(ev.starts_at, tz, locale);
      const end = formatDate(ev.ends_at, tz, locale);
      return start === end ? `${start} (all day)` : `${start} – ${end}`;
    }
    return `${formatDateTime(ev.starts_at, tz, locale)} – ${formatDateTime(ev.ends_at, tz, locale)}`;
  };

  const audienceLabel = (ev: CompanyEvent) => {
    if (ev.audience_type === 'everyone') return 'Everyone';
    if (ev.audience_type === 'people') return `${ev.audience_person_ids.length} people`;
    const names = ev.audience_department_ids
      .map(id => departments.find(d => d.id === id)?.name)
      .filter(Boolean);
    return names.length ? names.join(', ') : `${ev.audience_department_ids.length} departments`;
  };

  const isOpenForRsvp = (ev: CompanyEvent) =>
    ev.rsvp_enabled && ev.status === 'scheduled' && new Date(ev.ends_at).getTime() >= Date.now();

  const showActions = events.some(e => e.can_edit || e.can_delete);

  const columns: DataTableColumn<CompanyEvent>[] = [
    {
      key: 'title',
      header: 'Event',
      render: ev => (
        <Stack gap="tight">
          <Cluster gap="tight" align="center">
            <span className="font-medium text-fg">{ev.title}</span>
            {ev.status === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}
          </Cluster>
          {(ev.location || ev.meeting_url) && (
            <span className="text-fg-muted">{ev.location || ev.meeting_url}</span>
          )}
        </Stack>
      ),
    },
    {
      key: 'event_type',
      header: 'Type',
      render: ev => {
        const t = EVENT_TYPE_OPTIONS.find(o => o.value === ev.event_type) || EVENT_TYPE_OPTIONS[5];
        return <Badge tone={t.tone}>{t.label}</Badge>;
      },
    },
    { key: 'starts_at', header: 'When', render: ev => <span className="text-fg-muted">{formatWhen(ev)}</span> },
    { key: 'audience', header: 'For', render: ev => <span className="text-fg-muted">{audienceLabel(ev)}</span> },
    {
      key: 'rsvp',
      header: 'RSVP',
      interactive: true,
      render: ev => {
        if (!ev.rsvp_enabled) return <span className="text-fg-muted">—</span>;
        const counts = `${ev.rsvp.going} going · ${ev.rsvp.maybe} maybe`;
        if (!isOpenForRsvp(ev)) return <span className="text-fg-muted">{counts}</span>;
        return (
          <Stack gap="tight">
            <SegmentedControl
              aria-label={`Your response to ${ev.title}`}
              value={ev.rsvp.my_response ?? ''}
              onChange={(v: string) => {
                if (rsvpBusy !== ev.id && v !== ev.rsvp.my_response) handleRsvp(ev, v as RsvpResponse);
              }}
              options={RSVP_OPTIONS}
            />
            <span className="text-fg-muted">{counts}</span>
          </Stack>
        );
      },
    },
    ...(showActions ? [{
      key: 'actions',
      header: 'Actions',
      interactive: true,
      render: (ev: CompanyEvent) => (
        <Cluster gap="tight">
          {ev.can_edit && ev.status === 'scheduled' && (
            <IconButton label="Edit" icon={<Edit2 size={14} />} size="sm" onClick={() => setEditing(ev)} />
          )}
          {ev.can_edit && ev.status === 'scheduled' && (
            <IconButton label="Cancel event" icon={<Ban size={14} />} size="sm" onClick={() => handleCancelEvent(ev)} />
          )}
          {ev.can_delete && (
            <IconButton label="Delete" icon={<Trash2 size={14} />} size="sm" variant="danger" onClick={() => setConfirmDelete(ev)} />
          )}
        </Cluster>
      ),
    }] : []),
  ];

  return (
    <>
      <ListPageTemplate
        trail={[{ label: 'People', to: '/people' }]}
        title="Events"
        description="Town halls, trainings and celebrations across your organisation"
        primaryAction={
          canCreate ? (
            <Button onClick={() => setShowDrawer(true)}>
              <Plus size={16} />
              New Event
            </Button>
          ) : undefined
        }
        toolbarEnd={
          <SegmentedControl
            aria-label="Event period"
            value={when}
            onChange={(v: string) => setWhen(v === 'past' ? 'past' : 'upcoming')}
            options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]}
          />
        }
        loading={loading}
        isEmpty={events.length === 0}
        empty={
          <EmptyState
            icon={CalendarDays}
            title={when === 'past' ? 'No past events' : 'No upcoming events'}
            description={canCreate ? 'Create an event to invite your organisation, a department or selected people.' : 'Events you are invited to will show here.'}
            action={canCreate ? { label: 'New Event', onClick: () => setShowDrawer(true) } : undefined}
          />
        }
      >
        <DataTable columns={columns} rows={events} rowKey={ev => ev.id} />
      </ListPageTemplate>

      <CompanyEventDrawer
        isOpen={showDrawer || !!editing}
        onClose={closeDrawer}
        onSave={handleSave}
        event={editing}
        orgTz={orgTz}
        departments={departments}
      />

      <DeleteConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDeleteConfirmed(confirmDelete)}
        title="Delete Event"
        message={confirmDelete ? `Delete "${confirmDelete.title}" and all its RSVPs? This cannot be undone. To keep a record, cancel the event instead.` : ''}
        confirmText="Delete Event"
        isLoading={deleteBusy}
      />
    </>
  );
};

// =============================================================================
// Create / edit drawer
// =============================================================================

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CompanyEventPayload) => void;
  event: CompanyEvent | null;
  orgTz: string;
  departments: Department[];
}

interface FormState {
  title: string;
  event_type: CompanyEventType;
  all_day: boolean;
  start: string; // 'YYYY-MM-DDTHH:mm' in the event timezone
  end: string;
  location: string;
  meeting_url: string;
  description: string;
  audience_type: CompanyEventAudience;
  audience_department_ids: string[];
  rsvp_enabled: boolean;
}

const BLANK: FormState = {
  title: '', event_type: 'meeting', all_day: false, start: '', end: '', location: '', meeting_url: '',
  description: '', audience_type: 'everyone', audience_department_ids: [], rsvp_enabled: true,
};

export const CompanyEventDrawer: React.FC<DrawerProps> = ({ isOpen, onClose, onSave, event, orgTz, departments }) => {
  const [form, setForm] = useState<FormState>(BLANK);
  const [error, setError] = useState<string | null>(null);
  const tz = event?.timezone || orgTz;

  useEffect(() => {
    setError(null);
    if (event) {
      setForm({
        title: event.title,
        event_type: event.event_type,
        all_day: event.all_day,
        start: isoToWallTime(event.starts_at, tz),
        end: isoToWallTime(event.ends_at, tz),
        location: event.location || '',
        meeting_url: event.meeting_url || '',
        description: event.description || '',
        // 'people' audiences are API-only for now; keep them intact on edit.
        audience_type: event.audience_type,
        audience_department_ids: event.audience_department_ids || [],
        rsvp_enabled: event.rsvp_enabled,
      });
    } else {
      setForm(BLANK);
    }
  }, [event, isOpen, tz]);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const toggleDepartment = (id: string, on: boolean) =>
    set('audience_department_ids', on
      ? [...form.audience_department_ids, id]
      : form.audience_department_ids.filter(d => d !== id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    const startWall = form.all_day ? `${form.start.slice(0, 10)}T00:00` : form.start;
    const endWall = form.all_day ? `${(form.end || form.start).slice(0, 10)}T23:59` : form.end;
    const starts_at = wallTimeToIso(startWall, tz);
    const ends_at = wallTimeToIso(endWall, tz);
    if (!starts_at || !ends_at) { setError('Start and end are required'); return; }
    if (new Date(ends_at).getTime() < new Date(starts_at).getTime()) { setError('End must be after start'); return; }
    if (form.audience_type === 'department' && form.audience_department_ids.length === 0) {
      setError('Pick at least one department'); return;
    }
    setError(null);
    onSave({
      title: form.title.trim(),
      event_type: form.event_type,
      all_day: form.all_day,
      starts_at,
      ends_at,
      location: form.location.trim() || undefined,
      meeting_url: form.meeting_url.trim() || undefined,
      description: form.description.trim() || undefined,
      audience_type: form.audience_type,
      audience_department_ids: form.audience_type === 'department' ? form.audience_department_ids : [],
      ...(form.audience_type === 'people' && event ? { audience_person_ids: event.audience_person_ids } : {}),
      rsvp_enabled: form.rsvp_enabled,
    });
  };

  const audienceOptions = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'department', label: 'Departments' },
    ...(form.audience_type === 'people' ? [{ value: 'people', label: 'Selected people' }] : []),
  ];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={event ? 'Edit Event' : 'New Event'}
      subtitle={`Times are in ${tz}`}
      size="md"
      footer={
        <Cluster justify="end" gap="tight">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="company-event-form">{event ? 'Save Changes' : 'Create Event'}</Button>
        </Cluster>
      }
    >
      <form id="company-event-form" onSubmit={handleSubmit}>
        <Stack gap="default">
          {error && <Banner variant="danger">{error}</Banner>}
          <TextField name="ce-title" id="ce-title" label="Title *" required value={form.title}
            onChange={e => set('title', e.target.value)} placeholder="e.g. Quarterly town hall" />
          <Select name="ce-type" label="Type" value={form.event_type}
            onChange={e => set('event_type', e.target.value as CompanyEventType)}
            options={EVENT_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))} />
          <Switch name="ce-all-day" label="All day" checked={form.all_day} onCheckedChange={c => set('all_day', c)} />
          {form.all_day ? (
            <>
              <DateInput name="ce-start-date" label="Start date *" required value={form.start.slice(0, 10)}
                onChange={(v: string) => set('start', v ? `${v}T00:00` : '')} />
              <DateInput name="ce-end-date" label="End date" value={form.end.slice(0, 10)}
                onChange={(v: string) => set('end', v ? `${v}T23:59` : '')} />
            </>
          ) : (
            <>
              <DateTimePicker name="ce-start" label="Starts *" required value={form.start}
                onChange={(v: string) => set('start', v)} />
              <DateTimePicker name="ce-end" label="Ends *" required value={form.end}
                onChange={(v: string) => set('end', v)} />
            </>
          )}
          <TextField name="ce-location" id="ce-location" label="Location" value={form.location}
            onChange={e => set('location', e.target.value)} placeholder="Room, office or address" />
          <TextField name="ce-meeting-url" id="ce-meeting-url" label="Meeting link" value={form.meeting_url}
            onChange={e => set('meeting_url', e.target.value)} placeholder="https://" />
          <Textarea name="ce-description" label="Description" rows={3} value={form.description}
            onChange={e => set('description', e.target.value)} />
          <Select name="ce-audience" label="Who is invited" value={form.audience_type}
            onChange={e => set('audience_type', e.target.value as CompanyEventAudience)} options={audienceOptions} />
          {form.audience_type === 'department' && (
            <Stack gap="tight">
              {departments.length === 0 && <span className="text-fg-muted">No departments available</span>}
              {departments.map(d => (
                <Checkbox key={d.id} name={`ce-dept-${d.id}`} label={d.name}
                  checked={form.audience_department_ids.includes(d.id)}
                  onChange={e => toggleDepartment(d.id, e.target.checked)} />
              ))}
            </Stack>
          )}
          <Switch name="ce-rsvp" label="Collect RSVPs" checked={form.rsvp_enabled} onCheckedChange={c => set('rsvp_enabled', c)} />
        </Stack>
      </form>
    </Drawer>
  );
};

export default CompanyEventsPage;

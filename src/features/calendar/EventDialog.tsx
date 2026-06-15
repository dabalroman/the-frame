import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SegmentedToggle } from '@/components/SegmentedToggle';
import { cn } from '@/lib/utils';
import type { CalendarEvent, EventInput, Repeat } from '@/types/event';
import { todayLocal } from './format';

export type EventTarget =
  | { kind: 'add'; date?: string }
  | { kind: 'edit'; event: CalendarEvent };

type Props = {
  target: EventTarget | null;
  onClose: () => void;
  onChanged: () => void;
};

const FIELD =
  'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

/** Add / edit an event. Keyed inner form resets state per target. */
export function EventDialog({ target, onClose, onChanged }: Props) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      {target && (
        <EventForm
          key={target.kind === 'edit' ? `e${target.event.id}` : `a${target.date ?? ''}`}
          target={target}
          onClose={onClose}
          onChanged={onChanged}
        />
      )}
    </Dialog>
  );
}

function EventForm({ target, onClose, onChanged }: { target: EventTarget; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const editing = target.kind === 'edit';
  const init = editing ? target.event : null;

  const [title, setTitle] = useState(init?.title ?? '');
  const [date, setDate] = useState(init?.date ?? (target.kind === 'add' ? target.date ?? todayLocal() : todayLocal()));
  const [time, setTime] = useState(init?.time ?? '');
  const [repeat, setRepeat] = useState<Repeat>(init?.repeat ?? 'none');
  const [description, setDescription] = useState(init?.description ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim() || !date) { toast.error(t('calendar.validation')); return; }
    setSaving(true);
    const body: EventInput = { title: title.trim(), date, time: time || null, repeat, description: description.trim() || null };
    try {
      const res = await fetch(editing ? `/api/events/${init!.id}` : '/api/events', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(e.error ?? t('calendar.saveFailed'));
        return;
      }
      onChanged();
      onClose();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!init) return;
    const ev = init;
    const res = await fetch(`/api/events/${ev.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error(t('calendar.deleteFailed')); return; }
    onChanged();
    onClose();
    // Undo re-creates the event (a fresh id is acceptable for a calendar).
    toast(t('calendar.deleted', { title: ev.title }), {
      duration: 5000,
      action: {
        label: t('calendar.undo'),
        onClick: () => {
          void fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: ev.title, date: ev.date, time: ev.time, repeat: ev.repeat, description: ev.description }),
          }).then(() => onChanged());
        },
      },
    });
  }

  return (
    <DialogContent className="max-w-md">
      <DialogTitle>{editing ? t('calendar.editEvent') : t('calendar.newEvent')}</DialogTitle>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-foreground">{t('calendar.fieldTitle')}</span>
          <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('calendar.titlePlaceholder')} autoFocus />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm font-semibold text-foreground">{t('calendar.fieldDate')}</span>
            <input type="date" className={FIELD} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm font-semibold text-foreground">{t('calendar.fieldTime')}</span>
            <div className="flex items-center gap-1.5">
              <input type="time" className={cn(FIELD, 'flex-1')} value={time} onChange={(e) => setTime(e.target.value)} />
              <button
                type="button"
                onClick={() => setTime('')}
                disabled={!time}
                aria-label={t('calendar.clearTime')}
                title={t('calendar.clearTime')}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-foreground">{t('calendar.fieldRepeat')}</span>
          <SegmentedToggle<Repeat>
            value={repeat}
            onChange={setRepeat}
            options={[
              { value: 'none', label: t('calendar.repeatNone') },
              { value: 'yearly', label: t('calendar.repeatYearly') },
            ]}
          />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-foreground">{t('calendar.fieldDescription')}</span>
          <textarea className={cn(FIELD, 'min-h-[80px] resize-y')} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>

      <div className="flex items-center gap-2 pt-1">
        {editing && (
          <Button variant="outline" size="sm" onClick={del} className="mr-auto">
            <Trash2 className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            {t('calendar.delete')}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClose} className={editing ? '' : 'ml-auto'}>
          {t('calendar.cancel')}
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? t('calendar.saving') : t('calendar.save')}
        </Button>
      </div>
    </DialogContent>
  );
}

import { useState } from 'react';
import { Switch } from '../../../components/ui/switch';
import { toast } from 'sonner';
import { errorMessage } from "@/lib/errors";

export type NotificationPrefRow = {
  key: 'availabilityReminders' | 'statusChanges' | 'events' | 'dutyCrew' | 'deployments';
  label: string;
  description: string;
  enabled: boolean;
  available: boolean;
};

/**
 * One switch per push category. Categories for modules the member can't open
 * are hidden: they never get those pushes anyway.
 */
export function NotificationPrefsList({
  rows,
  onChange,
  emptyText = 'There are no notification types to manage.',
}: {
  rows: NotificationPrefRow[] | undefined;
  onChange: (key: NotificationPrefRow['key'], enabled: boolean) => Promise<unknown>;
  emptyText?: string;
}) {
  const [saving, setSaving] = useState<string | null>(null);

  if (rows === undefined) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>;
  }
  const visible = rows.filter((r) => r.available);
  if (visible.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>;
  }

  const handle = async (key: NotificationPrefRow['key'], enabled: boolean) => {
    setSaving(key);
    try {
      await onChange(key, enabled);
    } catch (error) {
      toast.error('Failed to save notification setting', {
        description: errorMessage(error),
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-2">
      {visible.map((row) => (
        <label
          key={row.key}
          htmlFor={`notif-${row.key}`}
          className="flex items-center justify-between gap-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{row.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{row.description}</p>
          </div>
          <Switch
            id={`notif-${row.key}`}
            checked={row.enabled}
            disabled={saving !== null}
            onCheckedChange={(checked) => void handle(row.key, checked)}
          />
        </label>
      ))}
    </div>
  );
}

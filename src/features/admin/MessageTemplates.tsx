import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import {
  BODY_TEMPLATE_MAX,
  NOTIFICATION_TEMPLATES,
  PLACEHOLDER_HELP,
  TITLE_TEMPLATE_MAX,
  renderTemplate,
  validateTemplate,
  type Placeholder,
  type TemplateKey,
} from "../../../convex/lib/notificationTemplates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationCard } from "@/components/shared/assignments/NotificationCard";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/dateFormat";

type Row = NonNullable<ReturnType<typeof useQuery<typeof api.notificationTemplates.listNotificationTemplates>>>[number];

/**
 * Admin → Notification Settings → Message templates. Edits the text of
 * assignment and event change notices. The preview uses the same renderer the
 * server sends with, so it matches.
 */
export function MessageTemplates() {
  const rows = useQuery(api.notificationTemplates.listNotificationTemplates);
  if (!rows) return null;
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const def = NOTIFICATION_TEMPLATES[row.key as TemplateKey];
    if (!def) continue;
    groups.set(def.group, [...(groups.get(def.group) ?? []), row]);
  }
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Message templates</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          The text members get when they're rostered or crewed, and when an event changes. Leave a field
          empty to use the standard wording.
        </p>
      </div>
      {[...groups].map(([group, items]) => (
        <section key={group} className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500">{group}</h4>
          {items.map((row) => (
            <TemplateCard key={`${row.key}:${row.updatedAt ?? 0}`} row={row} />
          ))}
        </section>
      ))}
    </div>
  );
}

function TemplateCard({ row }: { row: Row }) {
  const key = row.key as TemplateKey;
  const def = NOTIFICATION_TEMPLATES[key];
  const [title, setTitle] = useState(row.customised && row.title !== def.title ? row.title : "");
  const [body, setBody] = useState(row.customised && row.body !== def.body ? row.body : "");
  const [focused, setFocused] = useState<"title" | "body">("body");
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const save = useMutation(api.notificationTemplates.saveNotificationTemplate);
  const reset = useMutation(api.notificationTemplates.resetNotificationTemplate);

  const effective = { title: title.trim() ? title : def.title, body: body.trim() ? body : def.body };
  const error = validateTemplate(key, { title, body });
  const preview = renderTemplate(effective, def.sample);

  const insert = (name: Placeholder) => {
    const token = `{${name}}`;
    const el = focused === "title" ? titleRef.current : bodyRef.current;
    const value = focused === "title" ? title : body;
    // Inserting into an empty field starts from the default text
    const base = value || (focused === "title" ? def.title : def.body);
    const start = value ? (el?.selectionStart ?? base.length) : base.length;
    const end = value ? (el?.selectionEnd ?? base.length) : base.length;
    const next = base.slice(0, start) + token + base.slice(end);
    if (focused === "title") setTitle(next);
    else setBody(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ key, title, body });
      toast.success(`Saved "${def.label}"`);
    } catch (e) {
      toast.error("Not saved", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    await reset({ key });
    setTitle("");
    setBody("");
    toast.success(`"${def.label}" is back to the standard wording`);
  };

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{def.label}</CardTitle>
        <CardDescription>{def.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <input
              ref={titleRef}
              value={title}
              maxLength={TITLE_TEMPLATE_MAX}
              placeholder={def.title}
              onFocus={() => setFocused("title")}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              aria-label="Title"
            />
            <textarea
              ref={bodyRef}
              value={body}
              maxLength={BODY_TEMPLATE_MAX}
              placeholder={def.body}
              rows={3}
              onFocus={() => setFocused("body")}
              onChange={(e) => setBody(e.target.value)}
              className={inputClass}
              aria-label="Body"
            />
            <div className="flex flex-wrap gap-1.5">
              {def.placeholders.map((name) => (
                <button
                  key={name}
                  type="button"
                  title={PLACEHOLDER_HELP[name]}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(name)}
                  className="rounded-full border border-gray-300 dark:border-gray-600 px-2 py-0.5 font-mono text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {`{${name}}`}
                </button>
              ))}
            </div>
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Preview with sample values</div>
            <NotificationCard title={preview.title} body={preview.body} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-500">
            {row.customised && row.updatedAt
              ? `Edited by ${row.updatedByName ?? "an admin"} on ${formatDate(row.updatedAt)}`
              : "Standard wording"}
          </span>
          <div className="flex gap-2">
            {row.customised && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset to default
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving || !!error}>
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

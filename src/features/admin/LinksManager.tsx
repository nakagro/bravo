import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface LinksManagerProps {
  showTitle?: boolean;
}

export default function LinksManager({ showTitle = true }: LinksManagerProps) {
  const links = useQuery(api.links.getAllLinks);
  const createLink = useMutation(api.links.createLink);
  const updateLink = useMutation(api.links.updateLink);
  const deleteLink = useMutation(api.links.deleteLink);

  const [form, setForm] = useState({
    title: "",
    url: "",
    category: "",
    icon: "",
    order: 0,
    isActive: true,
  });

  const resetForm = () => setForm({ title: "", url: "", category: "", icon: "", order: 0, isActive: true });

  const isValid = useMemo(() => form.title.trim() !== "" && form.url.trim() !== "", [form]);

  const getNextOrderForCategory = (category: string | undefined) => {
    const cat = (category || "").trim();
    const inCat = (links || []).filter(l => (l.category || "") === cat);
    if (inCat.length === 0) return 0;
    return Math.max(...inCat.map(l => l.order ?? 0)) + 1;
  };

  const handleCreate = async () => {
    if (!isValid) return;
    const category = form.category.trim() || undefined;
    const order = getNextOrderForCategory(category);
    await createLink({
      title: form.title.trim(),
      url: form.url.trim(),
      category,
      icon: form.icon.trim() || undefined,
      order,
      isActive: !!form.isActive,
    });
    resetForm();
  };

  const handleUpdate = async (id: string, patch: Partial<typeof form>) => {
    await updateLink({ id: id as any, ...patch });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this link?")) return;
    await deleteLink({ id: id as any });
  };

  return (
    <Card data-component="LinksManager">
      {showTitle && (
        <CardHeader>
          <CardTitle>Links</CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-6">
        <div>
          <h3 className="font-medium mb-3">Add new link</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div className="lg:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="CFA Webmail" />
            </div>
            <div className="lg:col-span-2">
              <Label htmlFor="url">URL</Label>
              <Input id="url" value={form.url} onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://…" />
            </div>
            <div>
              <Label htmlFor="icon">Icon</Label>
              <Input id="icon" value={form.icon} onChange={(e) => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="🔗 or fa-class" />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input id="category" value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} placeholder="General" />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))} />
              <Label htmlFor="isActive">Active</Label>
            </div>
            <div className="lg:col-span-6">
              <Button onClick={handleCreate} disabled={!isValid}>Add Link</Button>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h3 className="font-medium">Existing links</h3>
          {links === undefined && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}
          {links && links.length === 0 && (
            <div className="text-sm text-muted-foreground">No links found.</div>
          )}
          {links && links.length > 0 && (
            <CategoryTables
              links={links}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              updateLink={updateLink}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type LinkDoc = any;

interface CategoryTablesProps {
  links: readonly LinkDoc[];
  onUpdate: (id: string, patch: Partial<any>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  updateLink: any;
}

function CategoryTables({ links, onUpdate, onDelete, updateLink }: CategoryTablesProps) {
  const dragFromId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overPos, setOverPos] = useState<"above" | "below" | null>(null);

  const categories = useMemo(() => {
    const groups = new Map<string, LinkDoc[]>();
    const normalized = (s: string | undefined | null) => (s || "").trim();
    const sorted = [...links].sort((a, b) => {
      const ca = normalized(a.category);
      const cb = normalized(b.category);
      if (ca !== cb) return ca.localeCompare(cb);
      return (a.order - b.order) || a.title.localeCompare(b.title);
    });
    for (const l of sorted) {
      const key = normalized(l.category);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(l);
    }
    return groups;
  }, [links]);

  const handleReorderWithinCategory = async (categoryKey: string, orderedIds: string[]) => {
    // Persist sequential order starting from 0 within the category.
    await Promise.all(
      orderedIds.map((id, idx) => updateLink({ id: id as any, order: idx }))
    );
  };

  const moveRow = async (categoryKey: string, ids: string[], fromIdx: number, direction: -1 | 1) => {
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= ids.length) return;
    const newIds = [...ids];
    const [moved] = newIds.splice(fromIdx, 1);
    newIds.splice(toIdx, 0, moved);
    await handleReorderWithinCategory(categoryKey, newIds);
  };

  return (
    <div className="space-y-6">
      {[...categories.entries()].map(([categoryKey, items]) => (
        <div key={categoryKey || "__uncat__"} className="overflow-x-auto">
          <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wide mb-2">
            {categoryKey || "Uncategorized"}
          </div>
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b">
                <th className="py-2 pr-2 w-8" title="Drag to reorder">&nbsp;</th>
                <th className="py-2 pr-2 w-20">Move</th>
                <th className="py-2 pr-2">Title</th>
                <th className="py-2 pr-2">URL</th>
                <th className="py-2 pr-2">Icon</th>
                <th className="py-2 pr-2">Category</th>
                <th className="py-2 pr-2">Active</th>
                <th className="py-2 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((link, index) => (
                <tr
                  key={link._id}
                  className={[
                    "border-b last:border-b-0",
                    draggingId === String(link._id) ? "opacity-60 bg-accent ring-2 ring-primary/40" : "",
                    overId === String(link._id) && overPos === "above" ? "border-t-2 border-primary" : "",
                    overId === String(link._id) && overPos === "below" ? "border-b-2 border-primary" : "",
                  ].join(" ")}
                  draggable
                  onDragStart={(e) => {
                    const id = String(link._id);
                    dragFromId.current = id;
                    setDraggingId(id);
                    e.dataTransfer.setData("text/plain", String(link._id));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    const rect = (e.currentTarget as HTMLTableRowElement).getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const pos = y < rect.height / 2 ? "above" : "below";
                    setOverId(String(link._id));
                    setOverPos(pos);
                  }}
                  onDragEnter={(e) => {
                    const rect = (e.currentTarget as HTMLTableRowElement).getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const pos = y < rect.height / 2 ? "above" : "below";
                    setOverId(String(link._id));
                    setOverPos(pos);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const fromId = dragFromId.current || e.dataTransfer.getData("text/plain");
                    const toId = String(link._id);
                    if (!fromId || fromId === toId) return;
                    // Only support reordering within same category group
                    const ids = items.map(i => String(i._id));
                    if (!ids.includes(fromId) || !ids.includes(toId)) return;
                    const fromIdx = ids.indexOf(fromId);
                    let toIdx = ids.indexOf(toId);
                    // If dropping below and moving forward, adjust index after removal
                    const droppingBelow = overId === toId && overPos === "below";
                    const newIds = [...ids];
                    const [moved] = newIds.splice(fromIdx, 1);
                    if (droppingBelow && fromIdx < toIdx) toIdx = toIdx - 0; // already adjusted by splice above
                    if (droppingBelow && fromIdx > toIdx) toIdx = toIdx + 1;
                    if (!droppingBelow && fromIdx < toIdx) toIdx = toIdx - 1;
                    newIds.splice(Math.max(0, Math.min(newIds.length, toIdx + (droppingBelow ? 1 : 0))), 0, moved);
                    await handleReorderWithinCategory(categoryKey, newIds);
                    // reset visuals
                    setDraggingId(null);
                    setOverId(null);
                    setOverPos(null);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverId(null);
                    setOverPos(null);
                  }}
                >
                  <td className="py-2 pr-2 align-middle cursor-grab select-none" title="Drag to reorder">
                    <span className="inline-block text-muted-foreground">⋮⋮</span>
                  </td>
                  <td className="py-2 pr-2 align-middle">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={index === 0}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const ids = items.map(i => String(i._id));
                          await moveRow(categoryKey, ids, index, -1);
                        }}
                        title="Move up"
                      >
                        ▲
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={index === items.length - 1}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const ids = items.map(i => String(i._id));
                          await moveRow(categoryKey, ids, index, 1);
                        }}
                        title="Move down"
                      >
                        ▼
                      </Button>
                    </div>
                  </td>
                  <td className="py-2 pr-2 min-w-[180px]">
                    <Input value={link.title} onChange={(e) => onUpdate(link._id as any, { title: e.target.value })} />
                  </td>
                  <td className="py-2 pr-2 min-w-[220px]">
                    <Input value={link.url} onChange={(e) => onUpdate(link._id as any, { url: e.target.value })} />
                  </td>
                  <td className="py-2 pr-2 min-w-[120px]">
                    <Input value={link.icon || ""} onChange={(e) => onUpdate(link._id as any, { icon: e.target.value })} placeholder="🔗" />
                  </td>
                  <td className="py-2 pr-2 min-w-[140px]">
                    <Input value={link.category || ""} onChange={(e) => onUpdate(link._id as any, { category: e.target.value })} />
                  </td>
                  <td className="py-2 pr-2 w-[90px]">
                    <div className="flex items-center gap-2">
                      <Switch checked={link.isActive} onCheckedChange={(v) => onUpdate(link._id as any, { isActive: v })} />
                      <span className="text-xs text-muted-foreground">{link.isActive ? "Active" : "Inactive"}</span>
                    </div>
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <Button variant="destructive" size="sm" onClick={() => onDelete(link._id as any)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

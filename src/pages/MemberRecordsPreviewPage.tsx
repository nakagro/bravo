import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  AtSign,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FolderOpen,
  Hash,
  Lock,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
import { PageTabs } from "@/components/shared/PageTabs";

/**
 * STATIC PREVIEW — Member Records mockup.
 * No backend: hardcoded members and item types held in local state so the
 * whole flow can be felt. This is a management-only tool for the nominated
 * equipment manager (plus officers, read-only if needed) — members never
 * see their own record. Mobile-first: searchable member list drilling down
 * into a profile page, no wide tables. Key requirement: item types are
 * admin-defined, not hardcoded. Delete or replace when the real module is
 * built.
 */

type FieldKind = "select" | "text" | "serial";

interface ItemType {
  id: string;
  name: string;
  kind: FieldKind;
  /** Options for select kinds */
  options?: string[];
  /** Must be handed back when the member leaves */
  returnable: boolean;
}

interface MemberValue {
  value: string;
  /** Only for returnable assets */
  issuedOn?: string;
  issuedBy?: string;
}

interface Member {
  id: string;
  name: string;
  rank: string;
  memberNumber: string;
  email: string;
  phone: string;
  values: Record<string, MemberValue>;
}

const initialItemTypes: ItemType[] = [
  { id: "glove", name: "Structure Glove Size", kind: "select", options: ["XS", "S", "M", "L", "XL", "2XL"], returnable: false },
  { id: "boot", name: "Boot Size", kind: "text", returnable: false },
  { id: "coat", name: "Structure Coat Size", kind: "select", options: ["S", "M", "L", "XL", "2XL", "3XL"], returnable: false },
  { id: "trouser", name: "Structure Trouser Size", kind: "select", options: ["S", "M", "L", "XL", "2XL", "3XL"], returnable: false },
  { id: "helmet", name: "Helmet Size", kind: "select", options: ["S", "M", "L"], returnable: false },
  { id: "pager", name: "Pager Serial #", kind: "serial", returnable: true },
  { id: "stationKey", name: "Station Key / Fob #", kind: "serial", returnable: true },
  { id: "uniform", name: "Brigade Polo Size", kind: "select", options: ["S", "M", "L", "XL", "2XL"], returnable: false },
];

const initialMembers: Member[] = [
  {
    id: "m1",
    name: "Shaun Gordon",
    rank: "Firefighter",
    memberNumber: "8412335",
    email: "shaun@example.com",
    phone: "0412 345 678",
    values: {
      glove: { value: "L" },
      boot: { value: "10.5" },
      coat: { value: "XL" },
      pager: { value: "PGR-04412", issuedOn: "12 Mar 2024", issuedBy: "Cpt. M. Harris" },
      stationKey: { value: "FOB-118", issuedOn: "12 Mar 2024", issuedBy: "Cpt. M. Harris" },
      uniform: { value: "XL" },
    },
  },
  {
    id: "m2",
    name: "Alex Nguyen",
    rank: "Lieutenant",
    memberNumber: "7290518",
    email: "alex.n@example.com",
    phone: "0423 456 789",
    values: {
      glove: { value: "M" },
      boot: { value: "9" },
      coat: { value: "L" },
      trouser: { value: "L" },
      helmet: { value: "M" },
      pager: { value: "PGR-03987", issuedOn: "02 Aug 2022", issuedBy: "Cpt. M. Harris" },
      uniform: { value: "L" },
    },
  },
  {
    id: "m3",
    name: "Priya Sharma",
    rank: "Firefighter",
    memberNumber: "8455102",
    email: "priya.s@example.com",
    phone: "0434 567 890",
    values: {
      glove: { value: "S" },
      coat: { value: "M" },
      trouser: { value: "M" },
      pager: { value: "PGR-05120", issuedOn: "19 Jan 2025", issuedBy: "Lt. A. Nguyen" },
      stationKey: { value: "FOB-131", issuedOn: "19 Jan 2025", issuedBy: "Lt. A. Nguyen" },
    },
  },
  {
    id: "m4",
    name: "Tom Riley",
    rank: "Probationary",
    memberNumber: "8501277",
    email: "tom.r@example.com",
    phone: "0445 678 901",
    values: {
      glove: { value: "XL" },
      boot: { value: "11" },
      uniform: { value: "XL" },
    },
  },
];

const kindLabels: Record<FieldKind, string> = {
  select: "Pick from list",
  text: "Free text",
  serial: "Serial number",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 pl-1">
      {children}
    </h2>
  );
}

/* ── Member list (mobile-first cards) ─────────────────────────────── */

function MemberList({
  itemTypes,
  members,
  onOpen,
}: {
  itemTypes: ItemType[];
  members: Member[];
  onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = members.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members…"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2.5 text-sm"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((m) => {
          const gaps = itemTypes.filter((t) => !m.values[t.id]).length;
          return (
            <button
              key={m.id}
              onClick={() => onOpen(m.id)}
              className="w-full bg-white dark:bg-gray-800 shadow-sm rounded-xl px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-750 active:scale-[0.99] transition-all"
            >
              <div className="h-11 w-11 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-red-700 dark:text-red-300">{initials(m.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-white truncate">{m.name}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {m.rank} · #{m.memberNumber}
                </div>
              </div>
              {gaps > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-[11px] font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                  {gaps} gap{gaps === 1 ? "" : "s"}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-6 text-center text-sm text-muted-foreground">
            No members match "{search}".
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 pl-1">
        "Gaps" counts items with nothing recorded yet — who needs chasing, at a glance.
      </p>
    </div>
  );
}

/* ── Member profile — the drill-down page ─────────────────────────── */

function MemberProfile({
  member,
  itemTypes,
  onSave,
  onBack,
}: {
  member: Member;
  itemTypes: ItemType[];
  onSave: (memberId: string, itemId: string, value: string) => void;
  onBack: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [collected, setCollected] = useState<Set<string>>(new Set());

  const sizes = itemTypes.filter((t) => !t.returnable);
  const assets = itemTypes.filter((t) => t.returnable);
  const toReturn = assets.filter((t) => member.values[t.id]);

  const save = (type: ItemType) => {
    onSave(member.id, type.id, draft);
    setEditingId(null);
    toast.success(`${type.name} updated`, {
      description: type.returnable
        ? "In the real module this logs an issue record — date, serial, and who issued it."
        : "In the real module this writes to the audit history.",
    });
  };

  const renderRow = (type: ItemType) => {
    const rec = member.values[type.id];
    const editing = editingId === type.id;
    return (
      <div key={type.id} className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-white">{type.name}</div>
          {rec?.issuedOn ? (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Issued {rec.issuedOn} by {rec.issuedBy}
            </div>
          ) : !rec && !editing ? (
            <div className="text-xs text-amber-600 dark:text-amber-400">Not recorded</div>
          ) : null}
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            {type.kind === "select" ? (
              <select
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm"
              >
                <option value="">—</option>
                {type.options?.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={type.kind === "serial" ? "Serial #" : ""}
                className="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm"
              />
            )}
            <button
              onClick={() => save(type)}
              className="px-3 py-1.5 min-h-[36px] text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white"
            >
              {type.returnable && !rec ? "Issue" : "Save"}
            </button>
            <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setEditingId(type.id);
              setDraft(rec?.value ?? "");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <span className={rec ? `font-semibold ${type.kind === "serial" ? "font-mono text-xs" : ""}` : "text-gray-400 italic"}>
              {rec?.value ?? (type.returnable ? "Issue" : "Set")}
            </span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-h-[44px] -my-2"
      >
        <ChevronLeft className="h-4 w-4" />
        All members
      </button>

      {/* Profile header — basic info comes free from the users table */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-red-700 dark:text-red-300">{initials(member.name)}</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{member.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{member.rank}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-300">
            <Hash className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="font-mono">{member.memberNumber}</span>
            <span className="text-xs text-gray-400">Member number</span>
          </div>
          <a href={`mailto:${member.email}`} className="flex items-center gap-2.5 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400">
            <AtSign className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="truncate">{member.email}</span>
          </a>
          <a href={`tel:${member.phone.replace(/\s/g, "")}`} className="flex items-center gap-2.5 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400">
            <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span>{member.phone}</span>
          </a>
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeading>Sizes</SectionHeading>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl divide-y divide-gray-100 dark:divide-gray-700">
          {sizes.map(renderRow)}
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeading>Issued gear</SectionHeading>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl divide-y divide-gray-100 dark:divide-gray-700">
          {assets.map(renderRow)}
        </div>
      </div>

      {/* Departure checklist — the "what do they need to return" moment */}
      {!checklistOpen ? (
        <button
          onClick={() => {
            setChecklistOpen(true);
            setCollected(new Set());
          }}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ClipboardCheck className="h-4 w-4" />
          Departure checklist
        </button>
      ) : (
        <div className="rounded-xl border-l-4 border-red-600 bg-white dark:bg-gray-800 shadow-sm p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-red-600 dark:text-red-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white flex-1">Departure checklist</h3>
            <button onClick={() => setChecklistOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          {toReturn.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Nothing on record to return.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {toReturn.map((t) => {
                const done = collected.has(t.id);
                return (
                  <label key={t.id} className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => {
                        setCollected((prev) => {
                          const next = new Set(prev);
                          if (next.has(t.id)) next.delete(t.id);
                          else next.add(t.id);
                          return next;
                        });
                      }}
                      className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className={`text-sm ${done ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-200"}`}>
                      {t.name} <span className="font-mono text-xs">{member.values[t.id].value}</span>
                      <span className="text-gray-400"> · issued {member.values[t.id].issuedOn}</span>
                    </span>
                  </label>
                );
              })}
              <button
                disabled={collected.size < toReturn.length}
                onClick={() => {
                  toast.success(`${member.name}'s gear all returned`, {
                    description: "In the real module this would clear their issued assets and log it to history.",
                  });
                  setChecklistOpen(false);
                }}
                className="mt-2 w-full px-4 py-2 min-h-[44px] text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all"
              >
                Mark all returned ({collected.size}/{toReturn.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Tab 2: Order sheet ───────────────────────────────────────────── */

function OrderSheetTab({ itemTypes, members }: { itemTypes: ItemType[]; members: Member[] }) {
  const orderSummary = useMemo(() => {
    return itemTypes
      .filter((t) => !t.returnable)
      .map((type) => {
        const counts = new Map<string, number>();
        let missing = 0;
        for (const m of members) {
          const v = m.values[type.id]?.value;
          if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
          else missing++;
        }
        return { type, counts: [...counts.entries()], missing };
      });
  }, [itemTypes, members]);

  return (
    <div className="space-y-2">
      <SectionHeading>Size counts across the brigade</SectionHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        {orderSummary.map(({ type, counts, missing }) => (
          <div key={type.id} className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{type.name}</h3>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {counts.map(([size, n]) => (
                <span key={size} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200">
                  {size} × {n}
                </span>
              ))}
              {missing > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-xs font-medium text-amber-700 dark:text-amber-300">
                  {missing} unknown
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 pl-1">
        The "order new gear without asking everyone" view — aggregated from member records.
      </p>
    </div>
  );
}

/* ── Tab 3: Item Types (config) ───────────────────────────────────── */

function ItemTypesTab({
  itemTypes,
  onAdd,
  onArchive,
}: {
  itemTypes: ItemType[];
  onAdd: (t: ItemType) => void;
  onArchive: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FieldKind>("select");
  const [options, setOptions] = useState("S, M, L, XL");
  const [returnable, setReturnable] = useState(false);

  const submit = () => {
    if (!name.trim()) return;
    onAdd({
      id: `custom-${Date.now()}`,
      name: name.trim(),
      kind,
      options: kind === "select" ? options.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      returnable,
    });
    toast.success(`"${name.trim()}" added`, {
      description: "It now appears on every member's record — no code change needed.",
    });
    setAdding(false);
    setName("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionHeading>Record item types</SectionHeading>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Add item type
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Name</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Flash Hood Size, Radio Serial #"
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Field type</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as FieldKind)}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              >
                {(Object.keys(kindLabels) as FieldKind[]).map((k) => (
                  <option key={k} value={k}>{kindLabels[k]}</option>
                ))}
              </select>
            </div>
          </div>
          {kind === "select" && (
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Options (comma separated)</label>
              <input
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer min-h-[44px]">
            <input type="checkbox" checked={returnable} onChange={(e) => setReturnable(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
            Must be returned when a member leaves
          </label>
          <div className="flex gap-2">
            <button onClick={submit} className="px-4 py-2 min-h-[44px] text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white">
              Add
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 min-h-[44px] text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl divide-y divide-gray-100 dark:divide-gray-700">
        {itemTypes.map((type) => (
          <div key={type.id} className="px-4 py-3 flex items-center gap-3">
            <FolderOpen className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white">{type.name}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">
                {kindLabels[type.kind]}
                {type.options && ` · ${type.options.join(" / ")}`}
              </div>
            </div>
            {type.returnable && (
              <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-[11px] font-semibold text-red-700 dark:text-red-300">
                Returnable
              </span>
            )}
            <button
              onClick={() => {
                onArchive(type.id);
                toast.success(`"${type.name}" archived`, {
                  description: "Archived types keep their historical values but stop appearing on records.",
                });
              }}
              className="p-2 min-h-[44px] rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Archive item type"
            >
              <Archive className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 pl-1">
        New types appear on every member's record instantly.
      </p>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default function MemberRecordsPreviewPage() {
  const [activeTab, setActiveTab] = useState("members");
  const [itemTypes, setItemTypes] = useState<ItemType[]>(initialItemTypes);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);

  const openMember = openMemberId ? members.find((m) => m.id === openMemberId) : null;

  const saveValue = (memberId: string, itemId: string, value: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              values: {
                ...m.values,
                [itemId]: m.values[itemId]
                  ? { ...m.values[itemId], value }
                  : {
                      value,
                      ...(itemTypes.find((t) => t.id === itemId)?.returnable
                        ? { issuedOn: "16 Jul 2026", issuedBy: "You" }
                        : {}),
                    },
              },
            }
          : m
      )
    );
  };

  return (
    <div className="space-y-4 max-w-2xl pb-8" data-component="MemberRecordsPreviewPage">
      <div className="rounded border border-dashed border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-200">
        <strong>Interactive preview</strong> — fake data, nothing is saved. Workshop mockup for a
        Member Records module.
      </div>

      {/* Inside a member profile, the profile IS the page — no page chrome competing with it */}
      {openMember ? (
        <MemberProfile
          member={openMember}
          itemTypes={itemTypes}
          onSave={saveValue}
          onBack={() => setOpenMemberId(null)}
        />
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
              <UserRound className="h-6 w-6 text-red-600 dark:text-red-500" />
              Member Records
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Sizes and issued gear for every member — so ordering doesn't need a survey, and
              departures don't need a memory.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 flex-shrink-0" />
              Restricted module — visible only to the nominated equipment manager and officers.
              Members never see this page or their own record.
            </p>
          </div>

          <PageTabs
            tabs={[
              { key: "members", label: "Members" },
              { key: "orders", label: "Order Sheet" },
              { key: "types", label: "Item Types" },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
            ariaLabel="Member records tabs"
          />

          {activeTab === "members" && (
            <MemberList itemTypes={itemTypes} members={members} onOpen={setOpenMemberId} />
          )}
          {activeTab === "orders" && <OrderSheetTab itemTypes={itemTypes} members={members} />}
          {activeTab === "types" && (
            <ItemTypesTab
              itemTypes={itemTypes}
              onAdd={(t) => setItemTypes((prev) => [...prev, t])}
              onArchive={(id) => setItemTypes((prev) => prev.filter((t) => t.id !== id))}
            />
          )}
        </>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { LIEUTENANT_NUMBERS, ordinal, type Rank } from "../../../../convex/lib/ranks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { MemberCombobox } from "@/components/shared/MemberCombobox";
import { ChevronDown, Link2, Pencil, UserPlus } from "lucide-react";
import { personName, rankLabel, type RosterEntry } from "../types";

const RANKS: Rank[] = ["Captain", "Lieutenant", "Firefighter", "Probationary", "Brigade Member"];

const whoOf = (entry: RosterEntry) =>
  entry.rollMemberId ? { rollMemberId: entry.rollMemberId } : { userId: entry.userId! };

/**
 * Everyone the roll calls. Members with a BRAVO account appear here on their
 * own; officers add everyone else by hand. A hand-added member whose CFA ID
 * matches an account is linked to it automatically.
 */
export function MembersTab() {
  const roster = useQuery(api.training.getRoster);
  const setActive = useMutation(api.training.setRollMemberActive);

  const [editing, setEditing] = useState<RosterEntry | "new" | null>(null);
  const [linking, setLinking] = useState<RosterEntry | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const active = (roster ?? []).filter((entry) => entry.isActive);
  const inactive = (roster ?? []).filter((entry) => !entry.isActive);
  const withoutAccount = active.filter((entry) => !entry.hasAccount).length;

  const toggleActive = async (entry: RosterEntry) => {
    try {
      await setActive({ who: whoOf(entry), isActive: !entry.isActive });
      toast.success(
        entry.isActive
          ? `${personName(entry)} is off future rolls`
          : `${personName(entry)} is back on the roll`
      );
    } catch (error) {
      toast.error("Couldn't update the member", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const renderEntry = (entry: RosterEntry) => (
    <li key={entry.key} className="flex items-center gap-2 py-2 pl-3 pr-1">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="font-medium text-foreground">{personName(entry)}</span>
          {rankLabel(entry) && (
            <span className="text-xs text-muted-foreground">{rankLabel(entry)}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {entry.memberNumber && <span>CFA {entry.memberNumber}</span>}
          {!entry.hasAccount && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              No BRAVO account
            </span>
          )}
        </div>
      </div>
      {!entry.hasAccount && entry.rollMemberId && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={() => setEditing(entry)}
            aria-label={`Edit ${personName(entry)}`}
            title="Edit"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={() => setLinking(entry)}
            aria-label={`Link ${personName(entry)} to a BRAVO account`}
            title="Link to a BRAVO account"
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        className="min-h-[44px] text-sm"
        onClick={() => void toggleActive(entry)}
      >
        {entry.isActive ? "Remove" : "Restore"}
      </Button>
    </li>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {roster === undefined
            ? "Loading..."
            : `${active.length} on the roll${withoutAccount > 0 ? `, ${withoutAccount} without a BRAVO account` : ""}`}
        </p>
        <Button onClick={() => setEditing("new")}>
          <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />
          Add member
        </Button>
      </div>

      {roster === undefined ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {active.map(renderEntry)}
        </ul>
      )}

      {inactive.length > 0 && (
        <section className="space-y-2" aria-label="Removed from the roll">
          <button
            onClick={() => setShowInactive((prev) => !prev)}
            aria-expanded={showInactive}
            className="flex w-full items-center gap-2 text-left min-h-[44px]"
          >
            <span className="text-sm font-semibold text-foreground">Removed from the roll</span>
            <span className="text-xs text-muted-foreground">{inactive.length}</span>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${showInactive ? "rotate-180" : ""}`}
            />
          </button>
          {showInactive && (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {inactive.map(renderEntry)}
            </ul>
          )}
        </section>
      )}

      {editing && (
        <RollMemberModal
          entry={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {linking && roster && (
        <LinkAccountModal entry={linking} roster={roster} onClose={() => setLinking(null)} />
      )}
    </div>
  );
}

function RollMemberModal({ entry, onClose }: { entry: RosterEntry | null; onClose: () => void }) {
  const addMember = useMutation(api.training.addRollMember);
  const updateMember = useMutation(api.training.updateRollMember);

  const [firstName, setFirstName] = useState(entry?.firstName ?? "");
  const [lastName, setLastName] = useState(entry?.lastName ?? "");
  const [memberNumber, setMemberNumber] = useState(entry?.memberNumber ?? "");
  const [rank, setRank] = useState<Rank | "">(entry?.rank ?? "");
  const [lieutenantNumber, setLieutenantNumber] = useState(
    entry?.lieutenantNumber ? String(entry.lieutenantNumber) : "none"
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const fields = {
      firstName,
      lastName,
      memberNumber: memberNumber.trim() || undefined,
      rank: rank || undefined,
      lieutenantNumber:
        rank === "Lieutenant" && lieutenantNumber !== "none" ? Number(lieutenantNumber) : undefined,
    };
    try {
      if (entry?.rollMemberId) {
        await updateMember({ rollMemberId: entry.rollMemberId, ...fields });
        toast.success("Member updated");
      } else {
        await addMember(fields);
        toast.success(`${firstName.trim()} ${lastName.trim()} added to the roll`);
      }
      onClose();
    } catch (error) {
      toast.error("Couldn't save the member", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

  return (
    <ResponsiveModal
      open
      onClose={onClose}
      title={entry ? "Edit member" : "Add a member to the roll"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !firstName.trim() || !lastName.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!entry && (
          <p className="text-sm text-muted-foreground">
            For a member without a BRAVO account. If they sign up later with the same CFA ID,
            their roll history moves with them.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="roll-first-name">
              First name
            </label>
            <input
              id="roll-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="roll-last-name">
              Last name
            </label>
            <input
              id="roll-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="roll-cfa-id">
            CFA ID (optional)
          </label>
          <input
            id="roll-cfa-id"
            value={memberNumber}
            onChange={(e) => setMemberNumber(e.target.value)}
            inputMode="numeric"
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="roll-rank">
            Rank
          </label>
          <Select value={rank || "none"} onValueChange={(v) => setRank(v === "none" ? "" : (v as Rank))}>
            <SelectTrigger id="roll-rank" className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No rank</SelectItem>
              {RANKS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {rank === "Lieutenant" && (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="roll-lt-number">
              Lieutenant number
            </label>
            <Select value={lieutenantNumber} onValueChange={setLieutenantNumber}>
              <SelectTrigger id="roll-lt-number" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not numbered</SelectItem>
                {LIEUTENANT_NUMBERS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {ordinal(n)} Lieutenant
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
}

/**
 * For a hand-added member whose CFA ID didn't match: point them at the account
 * that is them. Only accounts not yet holding their own roll history are
 * offered, so two histories never get tangled.
 */
function LinkAccountModal({
  entry,
  roster,
  onClose,
}: {
  entry: RosterEntry;
  roster: RosterEntry[];
  onClose: () => void;
}) {
  const linkMember = useMutation(api.training.linkRollMember);
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () =>
      roster
        .filter((e) => !e.rollMemberId && e.userId)
        .map((e) => ({ _id: e.userId!, name: personName(e), rank: rankLabel(e) || undefined })),
    [roster]
  );

  const save = async () => {
    if (!userId || !entry.rollMemberId) return;
    setSaving(true);
    try {
      await linkMember({ rollMemberId: entry.rollMemberId, userId });
      toast.success(`${personName(entry)} linked to their BRAVO account`);
      onClose();
    } catch (error) {
      toast.error("Couldn't link the account", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal
      open
      onClose={onClose}
      title={`Link ${personName(entry)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !userId}>
            {saving ? "Linking..." : "Link"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Their roll history moves to the account, and their name and rank come from it from now
          on.
        </p>
        <MemberCombobox
          label="BRAVO account"
          options={options}
          value={userId}
          onChange={setUserId}
          emptyText="No unlinked accounts match."
        />
      </div>
    </ResponsiveModal>
  );
}

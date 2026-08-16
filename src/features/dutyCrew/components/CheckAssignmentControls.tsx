import { useMemo, useState } from "react";
import { Check, Search, UserRound, UserRoundX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { cn } from "@/lib/utils";
import {
  getUserFullName,
  getUserInitials,
  type CrewAssignmentMember,
} from "../types";
import type { Id } from "../../../../convex/_generated/dataModel";

const memberLabel = (member: CrewAssignmentMember) =>
  member.firstName || getUserFullName(member);

interface AssignmentChipProps {
  member?: CrewAssignmentMember;
  /** Allocation comes from the item's area rather than the item itself. */
  inherited?: boolean;
  /**
   * Interactive only while the leader is allocating. Outside that mode the
   * chip is a plain read-only label, so an unassigned row shows nothing at all
   * and allocation stops reading like a required step.
   */
  onPress?: () => void;
  /**
   * Clears this allocation in one tap while allocating. Only passed for a
   * direct allocation - an inherited one has nothing of its own to clear.
   */
  onClear?: () => void;
  label: string;
  className?: string;
}

/**
 * The single allocation affordance on a row or section header.
 *
 * Deliberately renders nothing when there is no allocation and no allocating
 * in progress - the previous "+ Assign" button on every row implied every task
 * had to be handed out, when allocation is optional.
 */
export function AssignmentChip({
  member,
  inherited = false,
  onPress,
  onClear,
  label,
  className,
}: AssignmentChipProps) {
  if (!member && !onPress) return null;

  const content = member ? (
    <>
      <UserRound
        className={cn(
          "size-3.5 shrink-0",
          inherited ? "text-muted-foreground" : undefined,
        )}
        aria-hidden="true"
      />
      <span className="truncate">{memberLabel(member)}</span>
    </>
  ) : (
    <>
      <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">Assign</span>
    </>
  );

  if (!onPress) {
    return (
      <Badge
        variant="secondary"
        className={cn("max-w-32 gap-1 font-normal", className)}
        title={`${label}: ${getUserFullName(member!)}`}
      >
        {content}
      </Badge>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPress();
        }}
        aria-label={
          member ? `${label} - assigned to ${getUserFullName(member)}` : label
        }
        className={cn(
          "inline-flex h-9 max-w-36 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors active:scale-95",
          member
            ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
            : "border-dashed border-muted-foreground/40 text-muted-foreground hover:border-blue-400 hover:text-blue-600",
          className,
        )}
      >
        {content}
      </button>
      {member && onClear ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label={`Unassign ${getUserFullName(member)} from ${label.replace(/^Assign /, "")}`}
          title="Unassign"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 active:scale-95 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

interface MemberPickerSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  members: CrewAssignmentMember[];
  selectedId?: Id<"users">;
  /** Label for the clear option - differs for an item inheriting from its area. */
  clearLabel?: string;
  canClear: boolean;
  onSelect: (userId: Id<"users"> | undefined) => void;
}

/**
 * Full-height sheet (bottom drawer on mobile) for choosing who does a task.
 *
 * Replaces a dropdown menu, which on a phone opened a cramped popover that
 * could run off the bottom of the screen with rows too small to hit reliably.
 */
export function MemberPickerSheet({
  open,
  onClose,
  title,
  members,
  selectedId,
  clearLabel = "Clear allocation",
  canClear,
  onSelect,
}: MemberPickerSheetProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => getUserFullName(m).toLowerCase().includes(q));
  }, [members, search]);

  const choose = (userId: Id<"users"> | undefined) => {
    onSelect(userId);
    setSearch("");
    onClose();
  };

  return (
    <ResponsiveModal
      open={open}
      onClose={() => {
        setSearch("");
        onClose();
      }}
      title={title}
      drawerHeight="h-[70vh]"
    >
      <div className="space-y-3 pb-4">
        {members.length > 6 && (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search crew members"
              className="h-11 pl-9"
              aria-label="Search crew members"
            />
          </div>
        )}

        {members.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No members on this week's crew yet.
          </p>
        )}

        <div className="space-y-1">
          {filtered.map((member) => {
            const isSelected = member._id === selectedId;
            return (
              <button
                key={member._id}
                type="button"
                onClick={() => choose(member._id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors min-h-[52px]",
                  isSelected
                    ? "bg-blue-50 dark:bg-blue-950/40"
                    : "hover:bg-muted active:bg-muted",
                )}
              >
                <span
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground"
                  aria-hidden="true"
                >
                  {getUserInitials(member)}
                </span>
                <span className="flex-1 truncate text-sm font-medium">
                  {getUserFullName(member)}
                </span>
                {isSelected && (
                  <Check className="size-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                )}
              </button>
            );
          })}
          {filtered.length === 0 && members.length > 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No members match "{search}".
            </p>
          )}
        </div>

        {canClear && (
          <button
            type="button"
            onClick={() => choose(undefined)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-muted-foreground transition-colors min-h-[52px] hover:bg-muted"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/40">
              <UserRoundX className="size-4" aria-hidden="true" />
            </span>
            {clearLabel}
          </button>
        )}
      </div>
    </ResponsiveModal>
  );
}

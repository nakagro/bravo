import { CircleCheck, CircleX, DoorClosed, DoorOpen, Lock, LockOpen, ShieldAlert, WifiOff, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { statusToneClasses } from "@/lib/statusTone";
import { cn } from "@/lib/utils";
import { DOOR_LABEL, ago, type Door, type DoorStatus } from "../model";
import type { Progress } from "../useAccessCommands";
import { HoldToActButton } from "./HoldToActButton";

export const DOOR_ICON: Record<DoorStatus, LucideIcon> = {
  secured: DoorClosed,
  unlocked: LockOpen,
  open: DoorOpen,
  heldOpen: DoorOpen,
  forced: ShieldAlert,
  offline: WifiOff,
};

interface DoorTileProps {
  door: Door;
  now: number;
  /** False while the station can't take commands; the tile then shows status only. */
  available: boolean;
  progress?: Progress;
  onUnlock: () => void;
  /** Roller open, Keep unlocked, or a confirmation for a tap that can't be a hold. */
  onConfirm: (kind: "unlock" | "roller" | "keepUnlocked") => void;
  onLock: () => void;
}

/**
 * One door the member can act on. A door unlocks with a press and hold; a
 * roller opens from a confirmation, because it stays open and can't be closed
 * from here. Progress and the result replace the button for a few seconds.
 */
export function DoorTile({ door, now, available, progress, onUnlock, onConfirm, onLock }: DoorTileProps) {
  const info = DOOR_LABEL[door.status];
  const Icon = DOOR_ICON[door.status];
  const isRoller = door.kind === "roller";
  const keptUnlocked = door.status === "unlocked" && !door.unlockedUntil;
  const rollerOpen = isRoller && (door.status === "open" || door.status === "heldOpen");

  return (
    <div className="flex min-w-0 flex-col justify-between gap-3 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0">
        <div className="line-clamp-2 font-medium leading-snug text-foreground">{door.name}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={info.tone} className="gap-1">
            <Icon className="size-3" />
            {keptUnlocked ? "Kept unlocked" : info.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{ago(door.changedAt, now)}</span>
        </div>
      </div>

      {progress ? (
        <ProgressLine progress={progress} />
      ) : !available ? null : rollerOpen ? (
        <p className="py-2.5 text-center text-xs text-muted-foreground">Close it on site</p>
      ) : isRoller ? (
        <Button variant="outline" className="h-11 w-full touch-manipulation" onClick={() => onConfirm("roller")}>
          <DoorOpen className="size-4" />
          Open
        </Button>
      ) : keptUnlocked ? (
        <Button variant="outline" className="h-11 w-full touch-manipulation" onClick={onLock}>
          <Lock className="size-4" />
          Lock
        </Button>
      ) : (
        <div className="space-y-1.5">
          <HoldToActButton
            label="Hold to unlock"
            icon={<LockOpen />}
            onComplete={onUnlock}
            onTapFallback={() => onConfirm("unlock")}
          />
          {door.supportsHold && (
            <button
              type="button"
              onClick={() => onConfirm("keepUnlocked")}
              className="w-full touch-manipulation py-1 text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Keep unlocked…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Sending, Done or why it failed, in place of the button. */
export function ProgressLine({ progress, className }: { progress: Progress; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-center text-sm",
        statusToneClasses[progress.phase === "done" ? "success" : progress.phase === "failed" ? "danger" : "neutral"],
        progress.phase === "done" && "font-medium",
        className,
      )}
    >
      {progress.phase === "working" && <Spinner className="size-4 shrink-0" />}
      {progress.phase === "done" && <CircleCheck className="size-4 shrink-0" />}
      {progress.phase === "failed" && <CircleX className="size-4 shrink-0" />}
      <span className="line-clamp-3">{progress.text}</span>
    </div>
  );
}

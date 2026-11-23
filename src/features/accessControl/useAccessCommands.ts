import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { errorMessage } from "@/lib/errors";
import { commandFailureText, type Command, type CommandAction, type TargetKind } from "./model";

export interface CommandParams {
  siteId: string;
  targetKind: TargetKind;
  targetId: string;
  action: CommandAction;
  pulseMs?: number;
}

export interface Progress {
  phase: "working" | "done" | "failed";
  text: string;
}

/** Command TTL is 15 s and the bridge reports back within a few more. */
const ANSWER_TIMEOUT_MS = 25_000;
/** How long Done or a failure stays on the tile. */
const RESULT_VISIBLE_MS = 6_000;

class CommandFailed extends Error {}

export const progressKey = (siteId: string, targetId: string) => `${siteId}:${targetId}`;

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported (iOS); the on-screen result is enough.
  }
}

/**
 * Sends a command and waits for the station's answer, so the page can show
 * Sending, Done or why it failed on the thing that was tapped, not just in a
 * toast. `key` is which tile shows the progress; a chain (disarm then unlock)
 * passes the door's key for both steps.
 */
export function useAccessCommands(recentCommands: Command[]) {
  const requestCommand = useMutation(api.accessControl.requestCommand);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const waiters = useRef(new Map<string, (cmd: Command) => void>());
  const latest = useRef(recentCommands);
  const clearTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    latest.current = recentCommands;
    for (const cmd of recentCommands) {
      const resolve = waiters.current.get(cmd.id);
      if (resolve && cmd.status !== "pending" && cmd.status !== "executing") resolve(cmd);
    }
  }, [recentCommands]);

  useEffect(() => {
    const timers = clearTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const show = useCallback((key: string, next: Progress | null) => {
    const timers = clearTimers.current;
    const pending = timers.get(key);
    if (pending) clearTimeout(pending);
    setProgress((p) => {
      const copy = { ...p };
      if (next) copy[key] = next;
      else delete copy[key];
      return copy;
    });
    if (next && next.phase !== "working") {
      timers.set(key, setTimeout(() => show(key, null), RESULT_VISIBLE_MS));
    }
  }, []);

  const awaitAnswer = useCallback((commandId: string) => {
    return new Promise<Command>((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiters.current.delete(commandId);
        reject(new CommandFailed("The station didn't respond in time. Nothing was done."));
      }, ANSWER_TIMEOUT_MS);
      const done = (cmd: Command) => {
        clearTimeout(timeout);
        waiters.current.delete(commandId);
        resolve(cmd);
      };
      waiters.current.set(commandId, done);
      // The answer may already be in the last snapshot.
      const already = latest.current.find((c) => c.id === commandId);
      if (already && already.status !== "pending" && already.status !== "executing") done(already);
    });
  }, []);

  /** One step. Resolves when the station says it's done; throws with a member-readable reason. */
  const step = useCallback(
    async (params: CommandParams, key: string, workingText: string) => {
      show(key, { phase: "working", text: workingText });
      let commandId: string;
      try {
        ({ commandId } = await requestCommand(params));
      } catch (err) {
        throw new CommandFailed(errorMessage(err, "Couldn't send that to the station."));
      }
      const cmd = await awaitAnswer(commandId);
      if (cmd.status !== "succeeded") throw new CommandFailed(commandFailureText(cmd));
    },
    [awaitAnswer, requestCommand, show],
  );

  /**
   * Run one or more steps in order, stopping at the first failure. The tile
   * shows each step's text while it runs, then `doneText` or the failure.
   */
  const run = useCallback(
    async (key: string, steps: Array<{ params: CommandParams; workingText: string }>, doneText: string) => {
      try {
        for (const s of steps) await step(s.params, key, s.workingText);
        show(key, { phase: "done", text: doneText });
        buzz(30);
        return true;
      } catch (err) {
        show(key, { phase: "failed", text: err instanceof Error ? err.message : "Something went wrong." });
        buzz([60, 40, 60]);
        return false;
      }
    },
    [show, step],
  );

  return { progress, run };
}

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MemberCombobox, MemberOption } from "./MemberCombobox";
import {
  LoaderCircle,
  Save,
  User,
  Users,
  Flame,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { RANK_ORDER, isBARecordMemberOption } from "../memberEligibility";

interface BARecordFormProps {
  onSuccess?: () => void;
}

const DURATION_PRESETS = [15, 20, 30, 45];

type UsageType = "firecall" | "drill";

const USAGE_TYPES: Array<{
  key: UsageType;
  title: string;
  Icon: typeof Flame;
}> = [
  { key: "firecall", title: "Fire Call", Icon: Flame },
  { key: "drill", title: "Training", Icon: GraduationCap },
];

export function BARecordForm({ onSuccess }: BARecordFormProps) {
  const currentUser = useQuery(api.baRecords.getCurrentUser);
  const allMembers = useQuery(api.baRecords.listMembers);
  const createRecord = useMutation(api.baRecords.createRecord);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [isOnBehalf, setIsOnBehalf] = useState(false);
  const [memberId, setMemberId] = useState<Id<"users"> | null>(null);
  const [dateUsed, setDateUsed] = useState(() => new Date().toISOString().split("T")[0]);
  const [durationMinutes, setDurationMinutes] = useState("");
  const [usageType, setUsageType] = useState<UsageType>("firecall");
  const [notes, setNotes] = useState("");
  const [verifiedBy, setVerifiedBy] = useState<Id<"users"> | null>(null);

  // Default member = current user
  useEffect(() => {
    if (currentUser && !memberId && !isOnBehalf) {
      setMemberId(currentUser._id);
    }
  }, [currentUser, memberId, isOnBehalf]);

  // Toggle on-behalf clears member selection appropriately
  useEffect(() => {
    if (!isOnBehalf && currentUser) {
      setMemberId(currentUser._id);
    } else if (isOnBehalf) {
      setMemberId(null);
    }
  }, [isOnBehalf, currentUser]);

  const sortedMembers = useMemo(() => {
    if (!allMembers) return [];
    return allMembers.filter(isBARecordMemberOption).sort((a, b) => {
      const ra = RANK_ORDER[a.rank ?? ""] ?? 999;
      const rb = RANK_ORDER[b.rank ?? ""] ?? 999;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [allMembers]);

  const memberOptions: MemberOption[] = useMemo(
    () => sortedMembers.map((m) => ({ _id: m._id, name: m.name, rank: m.rank })),
    [sortedMembers],
  );

  const verifierOptions: MemberOption[] = useMemo(
    () =>
      sortedMembers
        .filter((m) => m._id !== memberId)
        .map((m) => ({ _id: m._id, name: m.name, rank: m.rank })),
    [sortedMembers, memberId],
  );

  const duration = parseInt(durationMinutes, 10);
  const isDurationValid = !isNaN(duration) && duration > 0 && duration <= 480;
  const isMemberValid = !!memberId;
  const isVerifierValid = !!verifiedBy && verifiedBy !== memberId;
  const isNotesValid = notes.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!isMemberValid || !isDurationValid || !isVerifierValid || !isNotesValid) return;

    setIsSubmitting(true);
    try {
      await createRecord({
        memberId: memberId!,
        dateUsed,
        durationMinutes: duration,
        usageType,
        notes: notes.trim(),
        verifiedBy: verifiedBy!,
      });
      toast.success("BA record submitted");
      // Reset; preserve usageType + on-behalf for batch entry
      setDurationMinutes("");
      setNotes("");
      setVerifiedBy(null);
      setAttempted(false);
      setDateUsed(new Date().toISOString().split("T")[0]);
      if (isOnBehalf) setMemberId(null);
      onSuccess?.();
    } catch (err) {
      console.error("Failed to create BA record:", err);
      toast.error(err instanceof Error ? err.message : "Failed to submit record");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentUser || !allMembers) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const checkmark = (
    <div className="shrink-0">
      <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-component="BARecordForm">
      {/* Who is this for? */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          Who is this for? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {([
            { active: !isOnBehalf, onClick: () => setIsOnBehalf(false), Icon: User, title: "For myself" },
            { active: isOnBehalf, onClick: () => setIsOnBehalf(true), Icon: Users, title: "Another member" },
          ] as const).map(({ active, onClick, Icon, title }, i) => (
            <button
              key={i}
              type="button"
              onClick={onClick}
              className={`relative px-2 py-3 sm:px-4 sm:py-4 rounded-lg border-2 transition-all text-left min-h-[64px] ${
                active
                  ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                  : "border-border hover:border-gray-400 dark:hover:border-gray-600"
              }`}
            >
              <div className="flex items-center gap-2 h-full">
                <div className={`shrink-0 rounded-full p-2 ${active ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"}`}>
                  <Icon className={`h-5 w-5 ${active ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-sm sm:text-base whitespace-nowrap ${active ? "text-red-900 dark:text-red-100" : ""}`}>{title}</div>
                </div>
                {active && checkmark}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Member Selection */}
      {isOnBehalf && (
        <MemberCombobox
          label="Select member"
          required
          options={memberOptions}
          value={memberId}
          onChange={setMemberId}
          placeholder="Search for a member"
          emptyText="No members found."
          error={attempted && !isMemberValid ? "Please select a member." : undefined}
        />
      )}

      {/* Type of use */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          Type of use <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {USAGE_TYPES.map(({ key, title, Icon }) => {
            const active = usageType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setUsageType(key)}
                className={`relative px-2 py-3 sm:px-4 sm:py-4 rounded-lg border-2 transition-all text-left min-h-[64px] ${
                  active
                    ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                    : "border-border hover:border-gray-400 dark:hover:border-gray-600"
                }`}
              >
                <div className="flex items-center gap-2 h-full">
                  <div className={`shrink-0 rounded-full p-2 ${active ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"}`}>
                    <Icon className={`h-5 w-5 ${active ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm sm:text-base whitespace-nowrap ${active ? "text-red-900 dark:text-red-100" : ""}`}>{title}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="dateUsed">
          Date <span className="text-red-500">*</span>
        </Label>
        <Input
          id="dateUsed"
          type="date"
          className="h-11"
          value={dateUsed}
          onChange={(e) => setDateUsed(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          required
        />
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <Label>
          Duration on air <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-4 gap-2">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDurationMinutes(String(preset))}
              className={`px-2 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                durationMinutes === String(preset)
                  ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300"
                  : "border-border hover:border-gray-400 dark:hover:border-gray-600 text-foreground"
              }`}
            >
              {preset} min
            </button>
          ))}
        </div>
        <Input
          id="duration"
          type="number"
          inputMode="numeric"
          min="1"
          max="480"
          placeholder="Or enter custom minutes..."
          className="h-11"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
        />
        {attempted && !isDurationValid && (
          <p className="text-sm text-destructive">
            {!durationMinutes ? "Please enter a duration." : "Duration must be between 1 and 480 minutes."}
          </p>
        )}
      </div>

      {/* Verifier — REQUIRED */}
      <MemberCombobox
        label="Verified by"
        required
        options={verifierOptions}
        value={verifiedBy}
        onChange={setVerifiedBy}
        placeholder="Search for a verifier"
        emptyText="No members found."
        helperText="Must be a different member who can confirm this BA usage."
        error={
          attempted && !isVerifierValid
            ? "Please select a verifier (cannot be the same person)."
            : undefined
        }
      />

      {/* Notes — required */}
      <div className="space-y-2">
        <Label htmlFor="notes">
          Notes <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="notes"
          placeholder={
            usageType === "firecall"
              ? "e.g., Structure fire \u2014 475 Ballan Rd, Wyndham Vale"
              : "e.g., BA drill at Wyndham Vale Fire Station"
          }
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="resize-none"
        />
        {attempted && !isNotesValid && (
          <p className="text-sm text-destructive">Please add a brief note about this BA usage.</p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full h-12 text-base" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Save className="mr-2 h-5 w-5" />
            Submit BA Record
          </>
        )}
      </Button>
    </form>
  );
}

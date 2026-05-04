import { useMemo } from "react";
import { useQuery } from "convex/react";
import { Download, LoaderCircle } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { CurrencyMember } from "../lib/types";

type BAExportRecord = {
  _id: string;
  memberId: string;
  memberName: string;
  dateUsed: string;
  durationMinutes: number;
  usageType: "firecall" | "drill";
  notes: string;
  verifierName: string;
  submitterName: string;
  submittedOnBehalf: boolean;
  createdAt: number;
  updatedAt: number;
};

const CSV_HEADERS = [
  "member_id",
  "member_name",
  "ba_skills",
  "currency_status",
  "last_usage_date",
  "days_since_last_use",
  "days_until_expiry",
  "record_id",
  "date_used",
  "duration_minutes",
  "usage_type",
  "notes",
  "verified_by",
  "submitted_by",
  "submitted_on_behalf",
  "record_created_at",
  "record_updated_at",
] as const;

function csvCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function timestampToIso(timestamp: number | undefined) {
  return timestamp ? new Date(timestamp).toISOString() : "";
}

function buildMemberRows(member: CurrencyMember, records: BAExportRecord[]) {
  const base = [
    member.userId,
    member.userName,
    member.skills.join("; "),
    member.status,
    member.lastUsageDate,
    member.daysSinceLastUse,
    member.daysUntilExpiry,
  ];

  if (records.length === 0) {
    return [[...base, "", "", "", "", "", "", "", "", "", ""]];
  }

  return records.map((record) => [
    ...base,
    record._id,
    record.dateUsed,
    record.durationMinutes,
    record.usageType,
    record.notes,
    record.verifierName,
    record.submitterName,
    record.submittedOnBehalf,
    timestampToIso(record.createdAt),
    timestampToIso(record.updatedAt),
  ]);
}

function buildCsv(members: CurrencyMember[], records: BAExportRecord[]) {
  const recordsByMember = new Map<string, BAExportRecord[]>();
  for (const record of records) {
    const existing = recordsByMember.get(record.memberId) ?? [];
    existing.push(record);
    recordsByMember.set(record.memberId, existing);
  }

  const memberIds = new Set<string>(members.map((member) => member.userId));
  const rows = members.flatMap((member) =>
    buildMemberRows(member, recordsByMember.get(member.userId) ?? []),
  );
  const additionalRecordRows = records
    .filter((record) => !memberIds.has(record.memberId))
    .map((record) => [
      record.memberId,
      record.memberName,
      "",
      "",
      "",
      "",
      "",
      record._id,
      record.dateUsed,
      record.durationMinutes,
      record.usageType,
      record.notes,
      record.verifierName,
      record.submitterName,
      record.submittedOnBehalf,
      timestampToIso(record.createdAt),
      timestampToIso(record.updatedAt),
    ]);

  return [CSV_HEADERS, ...rows, ...additionalRecordRows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

function downloadCsv(csv: string) {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `ba-skills-export-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function BASkillsExportTab() {
  const currency = useQuery(api.baCurrency.getBrigadeCurrency);
  const records = useQuery(api.baRecords.listRecords, {});

  const isLoading = currency === undefined || records === undefined;

  const csv = useMemo(() => {
    if (!currency || !records) return "";
    return buildCsv(currency.members, records);
  }, [currency, records]);

  const handleDownload = () => {
    if (!csv) return;
    downloadCsv(csv);
  };

  return (
    <div data-component="BASkillsExportTab">
      <div className="mb-4 overflow-hidden rounded bg-white shadow-sm dark:bg-gray-800">
        <div className="space-y-4 px-3 py-3 sm:px-4 sm:py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Export BA skills data</h2>
            <p className="text-sm text-muted-foreground">
              Download a CSV containing BA-skilled members, currency status, and all logged BA
              records.
            </p>
          </div>

          <Button onClick={handleDownload} disabled={isLoading || !csv} className="w-full sm:w-auto">
            {isLoading ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Preparing CSV..." : "Download CSV"}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { CurrencyMember } from "./types";

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
  lmsEnteredAt?: number;
  lmsEnteredByName?: string;
  createdAt: number;
  updatedAt: number;
};

function csvCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function timestampToIso(timestamp: number | undefined) {
  return timestamp ? new Date(timestamp).toISOString() : "";
}

function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null | undefined>>) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

const RECORD_HEADERS = [
  "member_name",
  "date_used",
  "duration_minutes",
  "usage_type",
  "notes",
  "verified_by",
  "submitted_by",
  "submitted_on_behalf",
  "lms_entered",
  "lms_entered_at",
  "lms_entered_by",
  "record_created_at",
  "record_updated_at",
] as const;

export function buildRecordsCsv(records: BAExportRecord[]) {
  return toCsv([
    RECORD_HEADERS,
    ...records.map((record) => [
      record.memberName,
      record.dateUsed,
      record.durationMinutes,
      record.usageType,
      record.notes,
      record.verifierName,
      record.submitterName,
      record.submittedOnBehalf,
      record.lmsEnteredAt !== undefined,
      timestampToIso(record.lmsEnteredAt),
      record.lmsEnteredByName,
      timestampToIso(record.createdAt),
      timestampToIso(record.updatedAt),
    ]),
  ]);
}

const CURRENCY_HEADERS = [
  "member_name",
  "ba_skills",
  "currency_status",
  "last_usage_date",
  "days_since_last_use",
  "days_until_expiry",
] as const;

export function buildCurrencyCsv(members: CurrencyMember[]) {
  return toCsv([
    CURRENCY_HEADERS,
    ...members.map((member) => [
      member.userName,
      member.skills.join("; "),
      member.status,
      member.lastUsageDate,
      member.daysSinceLastUse,
      member.daysUntilExpiry,
    ]),
  ]);
}

export function downloadCsv(csv: string, baseName: string) {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${baseName}-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

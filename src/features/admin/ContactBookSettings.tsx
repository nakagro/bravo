import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isContactBookData } from "@/features/kiosk/contactDirectoryData";
import { toastError } from "@/lib/errors";

interface ContactBookSettingsProps {
  showTitle?: boolean;
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Upload the District contact book JSON that powers Contacts and the kiosk
 * directory. The file is stored privately in Convex and only served to
 * signed-in accounts, never from public/.
 */
export default function ContactBookSettings({ showTitle = true }: ContactBookSettingsProps) {
  const summary = useQuery(api.contactDirectory.getAdminSummary);
  const generateUploadUrl = useMutation(api.contactDirectory.generateUploadUrl);
  const setDirectoryFile = useMutation(api.contactDirectory.setDirectoryFile);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error("That file isn't valid JSON.");
      }
      if (!isContactBookData(parsed)) {
        throw new Error("That file doesn't look like a contact book (missing sections, menu or search index).");
      }
      const source = (parsed as { source?: { title?: unknown } }).source;
      const title = typeof source?.title === "string" ? source.title : undefined;

      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: file,
      });
      if (!result.ok) throw new Error("Upload failed");
      const { storageId } = await result.json();

      await setDirectoryFile({ storageId, fileName: file.name, title });
      toast.success("Contact book updated");
    } catch (error) {
      toastError(error, "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card data-component="ContactBookSettings">
      {showTitle && (
        <CardHeader>
          <CardTitle>Contact Book</CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          The District contact book shown under Contacts and on the station kiosk. It contains
          people's contact details, so it is only shown to signed-in accounts.
        </p>

        {summary === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : summary === null ? (
          <p className="text-sm font-medium">No contact book uploaded yet.</p>
        ) : (
          <div className="text-sm space-y-1">
            <p className="font-medium">{summary.title ?? summary.fileName}</p>
            <p className="text-muted-foreground">
              {summary.fileName} · {formatSize(summary.sizeBytes)} · uploaded{" "}
              {new Date(summary.uploadedAt).toLocaleDateString("en-AU")} by {summary.uploadedByName}
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading…" : summary ? "Replace contact book" : "Upload contact book"}
        </Button>
      </CardContent>
    </Card>
  );
}

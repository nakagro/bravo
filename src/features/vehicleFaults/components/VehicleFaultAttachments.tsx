import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Paperclip, Upload, Trash2, FileText, X } from "lucide-react";
import { toast } from "sonner";

interface VehicleFaultAttachmentsProps {
  faultId: Id<"vehicleFaults">;
  mode: "view" | "edit";
}

export function VehicleFaultAttachments({ faultId, mode }: VehicleFaultAttachmentsProps) {
  const attachments = useQuery(api.vehicleFaults.getAttachments, { faultId });
  const generateUploadUrl = useMutation(api.vehicleFaults.generateUploadUrl);
  const addAttachment = useMutation(api.vehicleFaults.addAttachment);
  const deleteAttachment = useMutation(api.vehicleFaults.deleteAttachment);

  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"vehicleFaultAttachments"> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) throw new Error("Upload failed");

      const { storageId } = await result.json();
      await addAttachment({
        faultId,
        storageId,
        fileName: file.name,
        fileType: file.type,
      });

      toast.success("File uploaded");
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (attachmentId: Id<"vehicleFaultAttachments">) => {
    try {
      await deleteAttachment({ attachmentId });
      toast.success("Attachment deleted");
    } catch {
      toast.error("Failed to delete attachment");
    } finally {
      setDeletingId(null);
    }
  };

  if (!attachments) return null;

  const isImage = (fileType: string) => fileType.startsWith("image/");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5 text-gray-400" />
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Attachments {attachments.length > 0 && `(${attachments.length})`}
          </p>
        </div>
        {mode === "edit" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-1 h-7 text-xs"
            >
              <Upload className="h-3 w-3" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleUpload}
              className="hidden"
            />
          </>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic pl-5">
          No attachments
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pl-5">
          {attachments.map((attachment) => (
            <div key={attachment._id} className="relative group">
              {isImage(attachment.fileType) && attachment.url ? (
                <button
                  onClick={() => setPreviewUrl(attachment.url)}
                  className="w-full aspect-square rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-red-400 transition-colors"
                >
                  <img
                    src={attachment.url}
                    alt={attachment.fileName}
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <a
                  href={attachment.url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full aspect-square rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-red-400 transition-colors flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 gap-1"
                >
                  <FileText className="h-6 w-6 text-gray-400" />
                  <span className="text-[10px] text-gray-500 truncate max-w-full px-1">
                    {attachment.fileName}
                  </span>
                </a>
              )}
              {mode === "edit" && (
                <button
                  onClick={() => {
                    if (deletingId === attachment._id) {
                      handleDelete(attachment._id);
                    } else {
                      setDeletingId(attachment._id);
                      setTimeout(() => setDeletingId(null), 3000);
                    }
                  }}
                  className={`absolute -top-1.5 -right-1.5 rounded-full p-0.5 shadow-sm transition-colors ${
                    deletingId === attachment._id
                      ? "bg-red-600 text-white"
                      : "bg-white dark:bg-gray-700 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                  }`}
                  title={deletingId === attachment._id ? "Click again to confirm" : "Delete"}
                >
                  {deletingId === attachment._id ? (
                    <Trash2 className="h-3 w-3" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Attachment Preview</DialogTitle>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Attachment preview"
              className="w-full h-auto rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

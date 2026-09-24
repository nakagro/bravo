import { useEffect, useState, type ChangeEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { compressImage, validateImageFile } from "@/lib/imageCompression";
import { Image as ImageIcon, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";

interface DetailsEditorModalProps {
  open: boolean;
  onClose: () => void;
  /** e.g. "Item Details: Branch" */
  title: string;
  /** Alt text for the stored image */
  subjectName: string;
  initialDescription?: string;
  imageStorageId?: Id<"_storage">;
  descriptionPlaceholder: string;
  descriptionHint: string;
  uploadHint: string;
  onSave: (
    description?: string,
    imageStorageId?: Id<"_storage"> | null,
  ) => Promise<void>;
}

/**
 * Description + reference photo editor, shared by sections and items - the two
 * were byte-for-byte duplicates apart from their copy.
 *
 * Built on ResponsiveModal (drawer on phones) rather than a raw Dialog. That is
 * what stops the on-screen keyboard from springing up on open: the drawer's
 * close button precedes the form in the DOM, so focus lands there instead of in
 * the description field.
 */
export function DetailsEditorModal({
  open,
  onClose,
  title,
  subjectName,
  initialDescription,
  imageStorageId,
  descriptionPlaceholder,
  descriptionHint,
  uploadHint,
  onSave,
}: DetailsEditorModalProps) {
  const [description, setDescription] = useState(initialDescription ?? "");
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.inventoryTemplates.generateUploadUrl);
  const imageUrl = useQuery(
    api.inventoryTemplates.getImageUrl,
    imageStorageId ? { storageId: imageStorageId } : "skip",
  );

  useEffect(() => {
    if (open) {
      setDescription(initialDescription ?? "");
      setImageFile(null);
      setImagePreview(null);
    }
  }, [open, initialDescription]);

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error ?? "That image can't be used");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setUploading(true);
    try {
      let newImageStorageId: Id<"_storage"> | undefined = undefined;

      if (imageFile) {
        const compressedFile = await compressImage(imageFile);
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": compressedFile.type },
          body: compressedFile,
        });
        const { storageId } = await result.json();
        newImageStorageId = storageId;
      }

      await onSave(description.trim() || undefined, newImageStorageId);
      toast.success("Details saved");
      onClose();
    } catch {
      toast.error("Failed to save details");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    try {
      await onSave(description.trim() || undefined, null);
      toast.success("Image removed");
    } catch {
      toast.error("Failed to remove image");
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button
          onClick={() => void handleSave()}
          disabled={uploading}
        >
          {uploading ? (
            <span className="flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving...
            </span>
          ) : (
            "Save Details"
          )}
        </Button>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium" htmlFor="details-description">
            Description
          </label>
          <Textarea
            id="details-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={descriptionPlaceholder}
            className="mt-1"
            rows={3}
            disabled={uploading}
          />
          <p className="text-xs text-muted-foreground mt-1">{descriptionHint}</p>
        </div>

        {imageUrl && !imagePreview && (
          <div>
            <label className="text-sm font-medium">Current Image</label>
            <div className="relative mt-1">
              <img src={imageUrl} alt={subjectName} className="w-full rounded-lg border" />
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => void handleRemoveImage()}
                disabled={uploading}
              >
                <X className="h-4 w-4 mr-1" aria-hidden="true" />
                Remove
              </Button>
            </div>
          </div>
        )}

        {imagePreview && (
          <div>
            <label className="text-sm font-medium">New Image Preview</label>
            <div className="relative mt-1">
              <img src={imagePreview} alt="Preview" className="w-full rounded-lg border" />
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                }}
              >
                <X className="h-4 w-4 mr-1" aria-hidden="true" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!imagePreview && (
          <div>
            <label className="text-sm font-medium">
              {imageUrl ? "Replace Image" : "Add Reference Image"}
            </label>
            <div className="mt-1">
              <label className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="text-center">
                  <ImageIcon
                    className="h-8 w-8 mx-auto text-muted-foreground mb-2"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-muted-foreground">Tap to select image</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG or WebP (max 50MB)
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageSelect}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{uploadHint}</p>
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
}

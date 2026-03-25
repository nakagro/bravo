import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Id } from "../../../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";

interface VehicleFaultCommentsProps {
  faultId: Id<"vehicleFaults">;
}

export function VehicleFaultComments({ faultId }: VehicleFaultCommentsProps) {
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const comments = useQuery(api.vehicleFaults.getVehicleFaultComments, { faultId });
  const addComment = useMutation(api.vehicleFaults.addVehicleFaultComment);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!commentText.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    setIsSubmitting(true);
    try {
      await addComment({ faultId, text: commentText.trim() });
      setCommentText("");
      setIsFormOpen(false);
      toast.success("Comment added");
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUserDisplayName = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.name || "Unknown User";
  };

  return (
    <div className="space-y-3">
      {/* Add Comment */}
      {!isFormOpen ? (
        <Button
          onClick={() => setIsFormOpen(true)}
          variant="outline"
          size="sm"
          className="w-full gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          Add Comment
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment about this fault..."
            rows={3}
            className="resize-none text-sm"
            disabled={isSubmitting}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setCommentText("");
                setIsFormOpen(false);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !commentText.trim()}
              className="gap-1"
            >
              <Send className="h-3 w-3" />
              Post
            </Button>
          </div>
        </form>
      )}

      {/* Comments List */}
      {comments === undefined ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
              <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground">
          <MessageSquare className="h-6 w-6 mx-auto mb-1 opacity-50" />
          <p>No comments yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map((comment) => (
            <div
              key={comment._id}
              className="p-3 bg-muted/50 rounded-lg border border-border"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {getUserDisplayName(comment.user)}
                </p>
                <p className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDistanceToNow(comment.timestamp, { addSuffix: true })}
                </p>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                {comment.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

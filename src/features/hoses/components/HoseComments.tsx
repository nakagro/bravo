import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Trash2, MessageSquare } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toastError } from "@/lib/errors";

export function HoseComments({ hoseId }: { hoseId: Id<"hoses"> }) {
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const comments = useQuery(api.hoseComments?.list, { hoseId });
  const addComment = useMutation(api.hoseComments?.add);
  const deleteComment = useMutation(api.hoseComments?.remove);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await addComment({ hoseId, text: newComment.trim() });
      setNewComment("");
      toast.success("Comment added");
    } catch (error) {
      toastError(error, "Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: Id<"hoseComments">) => {
    try {
      await deleteComment({ commentId });
      toast.success("Comment deleted");
    } catch (error) {
      toastError(error, "Failed to delete comment");
    }
  };

  if (comments === undefined) {
    return (
      <div className="flex justify-center items-center h-16">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add comment form */}
      <form onSubmit={handleAddComment} className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="min-h-[60px] text-sm"
          rows={2}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !newComment.trim()}
            className="bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 text-white"
          >
            {isSubmitting ? "Adding..." : "Add Comment"}
          </Button>
        </div>
      </form>

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="text-center py-4">
          <MessageSquare className="h-6 w-6 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
          <p className="text-xs text-gray-400 dark:text-gray-500">No comments yet. Be the first to add one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment: {
            _id: Id<"hoseComments">;
            hoseId: Id<"hoses">;
            timestamp: number;
            text: string;
            user: {
              _id: Id<"users">;
              name: string;
              email: string | null;
            };
          }) => (
            <div key={comment._id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-red-700 dark:bg-red-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                    {comment.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-white">{comment.user.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-0.5">
                      {comment.text}
                    </p>
                  </div>
                </div>

                <ConfirmDialog
                  confirmLabel="Delete"
                  tone="destructive"
                  title="Delete this comment?"
                  description={`This comment by ${comment.user.name} will be permanently removed.`}
                  onConfirm={() => handleDeleteComment(comment._id)}
                  trigger={
                    <button
                      className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

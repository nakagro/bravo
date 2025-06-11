import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrashIcon } from "@heroicons/react/24/outline";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";

export function HoseComments({ hoseId }: { hoseId: Id<"hoses"> }) {
  const [newComment, setNewComment] = useState("");
  // TypeScript will recognize these functions once you run the app and Convex generates the types
  // @ts-ignore - The hoseComments API will be available after running the app
  const comments = useQuery(api.hoseComments?.list, { hoseId });
  // @ts-ignore - The hoseComments API will be available after running the app
  const addComment = useMutation(api.hoseComments?.add);
  // @ts-ignore - The hoseComments API will be available after running the app
  const deleteComment = useMutation(api.hoseComments?.remove);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await addComment({ hoseId, text: newComment.trim() });
      setNewComment("");
      toast.success("Comment added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add comment");
    }
  };

  const handleDeleteComment = async (commentId: Id<"hoseComments">) => {
    try {
      await deleteComment({ commentId });
      toast.success("Comment deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete comment");
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="mt-6 border-t border-border pt-4">
      <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Comments</h3>
      
      {/* Add comment form */}
      <form onSubmit={handleAddComment} className="mb-4">
        <div className="flex gap-2">
          <Input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-grow dark:bg-gray-800 dark:text-gray-100"
          />
          <Button
            type="submit"
            disabled={!newComment.trim()}
            className="bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
          >
            Add Comment
          </Button>
        </div>
      </form>
      
      {/* Comments list */}
      <div className="space-y-4 max-h-60 overflow-y-auto">
        {comments === undefined ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin h-5 w-5 border-2 border-red-700 dark:border-red-500 rounded-full border-t-transparent"></div>
          </div>
        ) : comments.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-2">No comments yet</p>
        ) : (
          comments.map((comment: {
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
            <div key={comment._id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {comment.user.name} • {formatDate(comment.timestamp)}
                  </p>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">{comment.text}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteComment(comment._id)}
                  className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-500"
                  title="Delete comment"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

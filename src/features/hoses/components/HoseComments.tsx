import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
    <div className="mt-6 border-t dark:border-gray-700 pt-4">
      <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Comments</h3>
      
      {/* Add comment form */}
      <form onSubmit={handleAddComment} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-grow border dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <button
            type="submit"
            disabled={!newComment.trim()}
            className="bg-red-700 dark:bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-800 dark:hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
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
                <button
                  onClick={() => handleDeleteComment(comment._id)}
                  className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-500"
                  title="Delete comment"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

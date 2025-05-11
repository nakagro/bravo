import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export function KeyComments({ keyId }: { keyId: Id<"keys"> }) {
  const comments = useQuery(api.keyComments.list, { keyId });
  const addComment = useMutation(api.keyComments.add);
  const removeComment = useMutation(api.keyComments.remove);
  
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await addComment({
        keyId,
        text: newComment.trim(),
      });
      setNewComment("");
      toast.success("Comment added");
    } catch (error: any) {
      toast.error(error.message || "Failed to add comment");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeleteComment = async (commentId: Id<"keyComments">) => {
    if (window.confirm("Are you sure you want to delete this comment?")) {
      try {
        await removeComment({ commentId });
        toast.success("Comment deleted");
      } catch (error: any) {
        toast.error(error.message || "Failed to delete comment");
        console.error(error);
      }
    }
  };
  
  if (comments === undefined) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-700"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <form onSubmit={handleAddComment} className="space-y-3">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
          rows={3}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
            className="px-4 py-2 bg-red-700 dark:bg-red-600 text-white rounded-md hover:bg-red-800 dark:hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Adding..." : "Add Comment"}
          </button>
        </div>
      </form>
      
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center italic">No comments yet</p>
        ) : (
          comments.map((comment) => (
            <div key={comment._id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex items-start space-x-2">
                  <div className="h-8 w-8 rounded-full bg-red-700 dark:bg-red-600 flex items-center justify-center text-white font-medium">
                    {comment.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{comment.user.name}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteComment(comment._id)}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  title="Delete comment"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div className="mt-2 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {comment.text}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

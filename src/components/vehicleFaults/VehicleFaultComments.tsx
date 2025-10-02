import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { MessageSquare, Send } from 'lucide-react';
import { toast } from '../../hooks/use-toast';
import { Id } from '../../../convex/_generated/dataModel';
import { formatDistanceToNow } from 'date-fns';

interface VehicleFaultCommentsProps {
  faultId: Id<'vehicleFaults'>;
}

export function VehicleFaultComments({ faultId }: VehicleFaultCommentsProps) {
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const comments = useQuery(api.vehicleFaults.getVehicleFaultComments, { faultId });
  const addComment = useMutation(api.vehicleFaults.addVehicleFaultComment);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!commentText.trim()) {
      toast({
        title: "Error",
        description: "Comment cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addComment({
        faultId,
        text: commentText.trim(),
      });
      
      setCommentText('');
      setIsFormOpen(false); // Close the form after successful submission
      toast({
        title: "Comment Added",
        description: "Your comment has been posted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setCommentText('');
    setIsFormOpen(false);
  };

  const getUserDisplayName = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.name || 'Unknown User';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comments {comments && comments.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Comment Button or Form */}
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
                onClick={handleCancel}
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
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
                <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No comments yet</p>
            <p className="text-xs mt-1">Be the first to comment on this fault</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment._id}
                className="p-3 bg-muted/50 rounded-lg border border-border"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {getUserDisplayName(comment.user)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(comment.timestamp, { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                  {comment.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

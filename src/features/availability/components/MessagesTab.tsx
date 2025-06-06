import React, { useState, useEffect } from 'react';
import { getRelativeTimeString } from "../../../utils/dateUtils";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader
} from "../../../components/ui/card";
import { cn } from "../../../lib/utils";

interface MessagesTabProps {
  isAuthenticated: boolean;
  newMessage: string;
  setNewMessage: (message: string) => void;
  messages: any[];
  handleSendMessage: () => void;
}

const MessagesTab: React.FC<MessagesTabProps> = ({
  isAuthenticated,
  newMessage,
  setNewMessage,
  messages,
  handleSendMessage
}) => {
  // Track the latest message ID for highlighting and previous message count
  const [latestMessageId, setLatestMessageId] = useState<string | null>(null);
  const [prevMessageCount, setPrevMessageCount] = useState(0);
  
  // Update latest message ID only when new messages are added
  useEffect(() => {
    // Only highlight if a new message was added (not on initial load)
    if (prevMessageCount > 0 && messages.length > prevMessageCount) {
      // Find the newest message (assuming messages are sorted newest first)
      const newestMessage = messages[0];
      setLatestMessageId(newestMessage._id);
      
      // Clear the highlight after a delay
      const timer = setTimeout(() => {
        setLatestMessageId(null);
      }, 2000); // 2 seconds highlight duration
      
      return () => clearTimeout(timer);
    }
    
    // Always update the previous count
    setPrevMessageCount(messages.length);
  }, [messages, prevMessageCount]);
  
  // Handle message submission
  const handleMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm p-4 rounded">
      <h3 className="text-lg font-medium mb-3">Messages</h3>
      
      {isAuthenticated ? (
        <>
          {/* Message Input Form */}
          <form onSubmit={handleMessageSubmit} className="mb-4 flex gap-2">
            <div className="flex-grow">
              <Input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                maxLength={150}
                className="dark:bg-gray-700 dark:text-white"
              />
            </div>
            <Button
              type="submit"
              disabled={!newMessage.trim()}
              variant={!newMessage.trim() ? "outline" : "default"}
            >
              Post
            </Button>
          </form>
          
          {/* Messages List */}
          <div className="space-y-3">
            {messages.length > 0 ? (
              messages.map((message) => (
                <Card 
                  key={message._id} 
                  className={cn(
                    "dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-0 transition-colors duration-500",
                    message._id === latestMessageId && "bg-blue-50 dark:bg-blue-900/20"
                  )}
                >
                  <div className="p-3"> {/* Use the same padding as the original design */}
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {message.user.firstName && message.user.lastName
                          ? `${message.user.firstName} ${message.user.lastName}`
                          : message.user.name || "Unknown User"}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getRelativeTimeString(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">{message.message}</p>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-0">
                <div className="p-3 text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    No messages yet.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </>
      ) : (
        <p className="text-gray-600 dark:text-gray-400">
          Please sign in to view and post messages.
        </p>
      )}
    </div>
  );
};

export default MessagesTab;

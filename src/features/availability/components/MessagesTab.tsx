import React, { useState, useEffect } from 'react';
import { getRelativeTimeString } from "../../../utils/dateUtils";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Pencil, Trash2, X, Check, Zap } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import MessagePresetManager from "./MessagePresetManager";

interface MessagesTabProps {
  isAuthenticated: boolean;
  newMessage: string;
  setNewMessage: (message: string) => void;
  messages: any[];
  handleSendMessage: () => void;
  currentUserId: Id<"users"> | null;
  handleDeleteMessage: (messageId: Id<"availabilityMessages">) => void;
  handleUpdateMessage: (messageId: Id<"availabilityMessages">, message: string) => void;
}

function MessagesTab({
  isAuthenticated,
  newMessage,
  setNewMessage,
  messages,
  handleSendMessage,
  currentUserId,
  handleDeleteMessage,
  handleUpdateMessage
}: MessagesTabProps) {
  // Track the latest message ID for highlighting and previous message count
  const [latestMessageId, setLatestMessageId] = useState<string | null>(null);
  const [prevMessageCount, setPrevMessageCount] = useState(0);

  // Track editing state
  const [editingMessageId, setEditingMessageId] = useState<Id<"availabilityMessages"> | null>(null);
  const [editedMessage, setEditedMessage] = useState("");

  // Preset state
  const [showPresetManager, setShowPresetManager] = useState(false);

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

  // Start editing a message
  const startEditing = (messageId: Id<"availabilityMessages">, currentMessage: string) => {
    setEditingMessageId(messageId);
    setEditedMessage(currentMessage);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditedMessage("");
  };

  // Save edited message
  const saveEdit = () => {
    if (editingMessageId && editedMessage.trim()) {
      handleUpdateMessage(editingMessageId, editedMessage.trim());
      setEditingMessageId(null);
      setEditedMessage("");
    }
  };

  // Handle delete with confirmation
  const confirmDelete = (messageId: Id<"availabilityMessages">) => {
    if (window.confirm("Are you sure you want to delete this message?")) {
      handleDeleteMessage(messageId);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
      {isAuthenticated ? (
        <>
          {/* Message Input Form */}
          <form onSubmit={handleMessageSubmit} className="p-3 border-b border-gray-200 dark:border-gray-700 flex gap-2">
            <div className="flex-grow">
              <Input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                maxLength={150}
              />
            </div>

            {/* Quick Messages Button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="flex-shrink-0"
              title="Quick messages"
              onClick={() => setShowPresetManager(true)}
            >
              <Zap className="h-4 w-4" />
            </Button>

            <Button
              type="submit"
              disabled={!newMessage.trim()}
              variant={!newMessage.trim() ? "outline" : "default"}
            >
              Post
            </Button>
          </form>

          {/* Messages List */}
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {messages.length > 0 ? (
              messages.map((message) => (
                <div
                  key={message._id}
                  className={`p-3 transition-colors duration-500 ${message._id === latestMessageId ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {message.user.firstName && message.user.lastName
                        ? `${message.user.firstName} ${message.user.lastName}`
                        : message.user.name || "Unknown User"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getRelativeTimeString(message.timestamp)}
                      </span>
                      {/* Show edit/delete buttons only for user's own messages within 10 minutes */}
                      {currentUserId && message.userId === currentUserId && (() => {
                        const tenMinutesInMs = 10 * 60 * 1000;
                        const messageAge = Date.now() - message.timestamp;
                        const canEdit = messageAge <= tenMinutesInMs;

                        return canEdit ? (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                              onClick={() => startEditing(message._id, message.message)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                              onClick={() => confirmDelete(message._id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  {/* Show edit input or message text */}
                  {editingMessageId === message._id ? (
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="text"
                        value={editedMessage}
                        onChange={(e) => setEditedMessage(e.target.value)}
                        maxLength={150}
                        className="flex-grow dark:bg-gray-700 dark:text-white"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400"
                        onClick={saveEdit}
                        disabled={!editedMessage.trim()}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={cancelEditing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-gray-700 dark:text-gray-300">{message.message}</p>
                  )}
                </div>
              ))
            ) : (
              <div className="p-3 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No messages yet.
                </p>
              </div>
            )}
          </div>

          {/* Quick Messages Drawer/Dialog */}
          {showPresetManager && (
            <MessagePresetManager onClose={() => setShowPresetManager(false)} />
          )}
        </>
      ) : (
        <div className="p-3">
          <p className="text-gray-600 dark:text-gray-400">
            Please sign in to view and post messages.
          </p>
        </div>
      )}
    </div>
  );
}

export default MessagesTab;

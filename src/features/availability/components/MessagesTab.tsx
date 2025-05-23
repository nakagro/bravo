import React from 'react';
import { getRelativeTimeString } from "../../../utils/dateUtils";

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
          <form onSubmit={handleMessageSubmit} className="mb-4 flex">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              maxLength={150}
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className={`px-4 py-2 rounded-r-md font-medium ${!newMessage.trim() ? 
                'bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400 cursor-not-allowed' : 
                'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800'}`}
            >
              Post
            </button>
          </form>
          
          {/* Messages List */}
          <div className="space-y-3">
            {messages.length > 0 ? (
              messages.map((message) => (
                <div key={message._id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-md">
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
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                No messages yet.
              </p>
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

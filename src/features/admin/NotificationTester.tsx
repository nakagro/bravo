import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface NotificationTesterProps {
  showTitle?: boolean;
}

export default function NotificationTester({ showTitle = true }: NotificationTesterProps) {
  const sendNotification = useAction(
    api.pushNotificationAction.sendNotification
  );
  const user = useQuery(api.auth.loggedInUser);
  
  const [title, setTitle] = useState("Test Title");
  const [body, setBody] = useState("This is a test push notification.");
  const [recipient, setRecipient] = useState<"all" | "self">("self");
  const [status, setStatus] = useState<string | null>(null);

  const handleSend = async () => {
    try {
      setStatus("sending");
      // If recipient is "self", pass the current user's ID; otherwise undefined for broadcast
      const userId = recipient === "self" && user?._id ? user._id : undefined;
      await sendNotification({ title, body, userId });
      setStatus("sent");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded shadow space-y-4">
      {showTitle && (
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">
          Push Notification Tester
        </h2>
      )}
      
      {/* Recipient Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Send to:
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="recipient"
              value="self"
              checked={recipient === "self"}
              onChange={(e) => setRecipient(e.target.value as "all" | "self")}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              My Device Only
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="recipient"
              value="all"
              checked={recipient === "all"}
              onChange={(e) => setRecipient(e.target.value as "all" | "self")}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              All Users
            </span>
          </label>
        </div>
      </div>

      {/* Notification Content */}
      <div className="space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Body"
          rows={3}
          className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
        />
      </div>
      
      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={status === "sending"}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === "sending" ? "Sending..." : `Send to ${recipient === "self" ? "My Device" : "All Users"}`}
      </button>
      
      {/* Status Messages */}
      {status === "sent" && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
          <p className="text-sm text-green-600 dark:text-green-400">
            ✓ Notification sent to {recipient === "self" ? "your device" : "all users"}!
          </p>
        </div>
      )}
      {status === "error" && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
          <p className="text-sm text-red-600 dark:text-red-400">
            ✗ Error sending notification. Check console for details.
          </p>
        </div>
      )}
    </div>
  );
}

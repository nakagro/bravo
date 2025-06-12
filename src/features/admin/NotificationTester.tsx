import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface NotificationTesterProps {
  showTitle?: boolean;
}

export default function NotificationTester({ showTitle = true }: NotificationTesterProps) {
  const sendNotification = useAction(
    api.pushNotificationAction.sendNotification
  );
  const [title, setTitle] = useState("Test Title");
  const [body, setBody] = useState("This is a test push notification.");
  const [status, setStatus] = useState<string | null>(null);

  const handleSend = async () => {
    try {
      setStatus("sending");
      await sendNotification({ title, body, userId: undefined });
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
      <div className="space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Body"
          className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white"
        />
      </div>
      <button
        onClick={handleSend}
        disabled={status === "sending"}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {status === "sending" ? "Sending..." : "Send Test Notification"}
      </button>
      {status === "sent" && (
        <p className="text-green-600 dark:text-green-400">Notification sent!</p>
      )}
      {status === "error" && (
        <p className="text-red-600 dark:text-red-400">
          Error sending notification. Check console.
        </p>
      )}
    </div>
  );
}

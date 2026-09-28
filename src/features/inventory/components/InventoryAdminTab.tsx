import { useState } from "react";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { NotificationRecipientsSection } from "@/components/shared/NotificationRecipientsSection";
import { InventoryAdminOverview } from "./InventoryAdminOverview";
import { InventoryAdminRecords } from "./InventoryAdminRecords";

interface InventoryAdminTabProps {
  isAuthenticated: boolean;
}

type AdminSection = "overview" | "records" | "notifications";

const SECTIONS = [
  { key: "overview", label: "Overview" },
  { key: "records", label: "Records" },
  { key: "notifications", label: "Notify" },
] as const;

// Overview answers "is every appliance checked this week, and is anything
// stuck"; Records is the full list for looking things up and cleaning up;
// Notify is who hears about completed checks.
export function InventoryAdminTab({ isAuthenticated }: InventoryAdminTabProps) {
  const [section, setSection] = useState<AdminSection>("overview");

  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">Please log in to access admin features.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SegmentedTabs
        segments={SECTIONS}
        value={section}
        onChange={setSection}
        ariaLabel="Inventory admin sections"
      />

      {section === "overview" && <InventoryAdminOverview />}
      {section === "records" && <InventoryAdminRecords />}
      {section === "notifications" && (
        <NotificationRecipientsSection
          conditionKey="inventory:checkCompleted"
          moduleId="inventory"
          url="/inventory?tab=history"
          title="Inventory check completed"
          description="Tell the people who hold the equipment portfolio when an inventory check is completed, including anything missing, miscounted or left unchecked."
        />
      )}
    </div>
  );
}

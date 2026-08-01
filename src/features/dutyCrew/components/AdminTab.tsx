import { useState } from "react";
import { Users, ClipboardList, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationRecipientsSection } from "@/components/shared/NotificationRecipientsSection";
import { CrewManagementSection } from "./CrewManagementSection";
import { CheckTemplatesSection } from "./CheckTemplatesSection";

type AdminSection = "crews" | "templates" | "notifications";

const sections: Array<{
  key: AdminSection;
  label: string;
  icon: typeof Users;
}> = [
  { key: "crews", label: "Crews", icon: Users },
  { key: "templates", label: "Templates", icon: ClipboardList },
  { key: "notifications", label: "Notify", icon: Bell },
];

export function AdminTab() {
  const [section, setSection] = useState<AdminSection>("crews");

  return (
    <div className="space-y-4">
      {/* Segmented section switcher */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        {sections.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            aria-pressed={section === key}
            className={cn(
              "flex items-center justify-center gap-2 min-h-[40px] rounded-md text-sm font-medium transition-colors",
              section === key
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {section === "crews" && <CrewManagementSection />}
      {section === "templates" && <CheckTemplatesSection />}
      {section === "notifications" && (
        <NotificationRecipientsSection
          conditionKey="dutyCrew:checksSubmitted"
          title="Weekly station checks submitted"
          description="Tell the people who hold the duty crew portfolio when a crew submits their week's checks, including anything marked N/A or left with a note."
        />
      )}
    </div>
  );
}

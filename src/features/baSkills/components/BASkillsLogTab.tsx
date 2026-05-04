import { Info } from "lucide-react";
import { BARecordForm } from "./BARecordForm";

export function BASkillsLogTab() {
  return (
    <div data-component="BASkillsLogTab">
      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="px-3 py-3">
          <BARecordForm />
        </div>
      </div>

      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="px-3 py-2 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>BA qualifications require active use at least once every 6 months to stay current.</p>
        </div>
      </div>
    </div>
  );
}

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Users, ClipboardList, History } from "lucide-react";
import { CrewManagementSection } from "./CrewManagementSection";
import { CheckTemplatesSection } from "./CheckTemplatesSection";
import { CheckHistorySection } from "./CheckHistorySection";

export function AdminTab() {
  return (
    <Accordion type="multiple" defaultValue={["crews"]} className="space-y-3">
      <AccordionItem
        value="crews"
        className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
      >
        <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 [&[data-state=open]]:border-b [&[data-state=open]]:border-gray-200 dark:[&[data-state=open]]:border-gray-700">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              Crew Management
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pt-4 pb-4">
          <CrewManagementSection />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem
        value="templates"
        className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
      >
        <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 [&[data-state=open]]:border-b [&[data-state=open]]:border-gray-200 dark:[&[data-state=open]]:border-gray-700">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              Check Templates
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pt-4 pb-4">
          <CheckTemplatesSection />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem
        value="history"
        className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
      >
        <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 [&[data-state=open]]:border-b [&[data-state=open]]:border-gray-200 dark:[&[data-state=open]]:border-gray-700">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              Check History
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pt-4 pb-4">
          <CheckHistorySection />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

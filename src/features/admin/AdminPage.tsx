import UserManagement from "./UserManagement";
import ModuleSettings from "./ModuleSettings";
import NotificationTester from "./NotificationTester";
import NotificationSettings from "./NotificationSettings";
import EmailSettings from "./EmailSettings";
import AdminTasks from "./AdminTasks";
import LinksManager from "./LinksManager";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

export default function AdminPage() {
  return (
    <div className="space-y-6" data-component="AdminPage">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Settings</h1>
      </div>
      
      {/* Keep User Management always visible */}
      <UserManagement />

      {/* Collapsible sections */}
      <Accordion type="multiple" className="w-full space-y-2">
        <AccordionItem value="moduleSettings">
          <AccordionTrigger className="text-xl font-semibold text-gray-900 dark:text-white">Module Settings</AccordionTrigger>
          <AccordionContent>
            <ModuleSettings showTitle={false} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="links">
          <AccordionTrigger className="text-xl font-semibold text-gray-900 dark:text-white">Links</AccordionTrigger>
          <AccordionContent>
            <LinksManager showTitle={false} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="notificationTester">
          <AccordionTrigger className="text-xl font-semibold text-gray-900 dark:text-white">Notification Tester</AccordionTrigger>
          <AccordionContent>
            <NotificationTester showTitle={false} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="notificationSettings">
          <AccordionTrigger className="text-xl font-semibold text-gray-900 dark:text-white">Notification Settings</AccordionTrigger>
          <AccordionContent>
            <NotificationSettings showTitle={false} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="emailSettings">
          <AccordionTrigger className="text-xl font-semibold text-gray-900 dark:text-white">Email Settings</AccordionTrigger>
          <AccordionContent>
            <EmailSettings showTitle={false} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="adminTasks">
          <AccordionTrigger className="text-xl font-semibold text-gray-900 dark:text-white">Admin Tasks</AccordionTrigger>
          <AccordionContent>
            <AdminTasks showTitle={false} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

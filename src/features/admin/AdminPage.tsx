import UserManagement from "./UserManagement";
import ModuleSettings from "./ModuleSettings";
import NotificationTester from "./NotificationTester";
import NotificationSettings from "./NotificationSettings";
import EmailSettings from "./EmailSettings";
import AdminTasks from "./AdminTasks";
import LinksManager from "./LinksManager";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

export default function AdminPage() {
  const navigate = useNavigate();

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

        <AccordionItem value="feedback">
          <AccordionTrigger className="text-xl font-semibold text-gray-900 dark:text-white">Feedback Management</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                View and manage all user feedback submissions.
              </p>
              <Button
                onClick={() => navigate("/admin/feedback")}
                variant="default"
                className="w-full sm:w-auto flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                View All Feedback
              </Button>
            </div>
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

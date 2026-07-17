import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { KeyComments } from "./KeyComments";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Phone,
  Mail,
  User,
  Copy,
  Pencil,
  KeyRound,
  CreditCard,
  Hash,
  FileText,
  StickyNote,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// Type icon mapping
function getItemTypeIcon(type: string) {
  switch (type) {
    case "Key": return <KeyRound className="h-4 w-4" />;
    case "Fob": return <Hash className="h-4 w-4" />;
    case "Swipe": return <CreditCard className="h-4 w-4" />;
    case "Code": return <FileText className="h-4 w-4" />;
    default: return <KeyRound className="h-4 w-4" />;
  }
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copied`);
  });
}

export function KeyDetailPanel({
  keyId,
  onClose,
  onEdit,
}: {
  keyId: Id<"keys">;
  onClose: () => void;
  onEdit: () => void;
}) {
  const isMobile = useIsMobile();
  const key = useQuery(api.keys.get, { id: keyId });
  const keyItems = useQuery(api.keyItems.list, { keyId });
  const history = useQuery(api.keys.getHistory, { keyId });

  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);

  if (!key) {
    return null;
  }

  const content = (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-red-700 dark:text-red-400">
              {key.pegNumber}
            </span>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {key.siteName}
            </h2>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-5 pb-24">
        {/* Address with copy */}
        <div className="space-y-1">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-gray-100">{key.address}</p>
            </div>
            <button
              onClick={() => copyToClipboard(key.address, "Address")}
              className="flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Copy address"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Contact info with quick actions */}
        {(key.contactName || key.contactPhone || key.contactEmail) && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Contact</p>

            {key.contactName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-900 dark:text-gray-100">{key.contactName}</span>
              </div>
            )}

            {key.contactPhone && (
              <div className="flex items-center justify-between">
                <a
                  href={`tel:${key.contactPhone}`}
                  className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 hover:underline"
                >
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                  {key.contactPhone}
                </a>
                <button
                  onClick={() => copyToClipboard(key.contactPhone!, "Phone number")}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Copy phone"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            )}

            {key.contactEmail && (
              <div className="flex items-center justify-between">
                <a
                  href={`mailto:${key.contactEmail}`}
                  className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 hover:underline truncate"
                >
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  {key.contactEmail}
                </a>
                <button
                  onClick={() => copyToClipboard(key.contactEmail!, "Email")}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Copy email"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {key.notes && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5 text-gray-400" />
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Notes</p>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap pl-5">
              {key.notes}
            </p>
          </div>
        )}

        {/* Key Items - inline */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Items on Peg {key.pegNumber}
            </p>
          </div>

          {keyItems === undefined ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-700 dark:border-red-500"></div>
            </div>
          ) : keyItems.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic pl-5">
              No items recorded for this peg
            </p>
          ) : (
            <div className="space-y-1.5 pl-5">
              {keyItems.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-md bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800"
                >
                  <span className="text-gray-500 dark:text-gray-400">
                    {getItemTypeIcon(item.type)}
                  </span>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.type}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">{item.description}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comments - collapsible */}
        <div className="space-y-2">
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 w-full group"
          >
            <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide group-hover:text-gray-700 dark:group-hover:text-gray-300">
              Comments
            </p>
            {showComments ? (
              <ChevronUp className="h-3.5 w-3.5 text-gray-400 ml-auto" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-auto" />
            )}
          </button>

          {showComments && (
            <div className="pl-5">
              <KeyComments keyId={keyId} />
            </div>
          )}
        </div>

        {/* History - collapsible */}
        <div className="space-y-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 w-full group"
          >
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide group-hover:text-gray-700 dark:group-hover:text-gray-300">
              Change History
            </p>
            {showHistory ? (
              <ChevronUp className="h-3.5 w-3.5 text-gray-400 ml-auto" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-auto" />
            )}
          </button>

          {showHistory && (
            <div className="pl-5 space-y-2">
              {history === undefined ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-700 dark:border-red-500"></div>
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">No changes recorded</p>
              ) : (
                history.slice(0, 10).map((entry) => (
                  <HistoryEntry key={entry._id} entry={entry} />
                ))
              )}
              {history && history.length > 10 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Showing 10 of {history.length} changes
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 pt-3 pb-8 md:pb-3 bg-background -mx-6 px-6 -mb-6 mt-auto">
        <Button
          onClick={onEdit}
          className="w-full h-11 bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 text-white"
        >
          <Pencil className="h-4 w-4 mr-2" />
          Edit Key
        </Button>
      </div>
    </div>
  );

  // Mobile: full-screen drawer from bottom
  if (isMobile) {
    return (
      <Drawer open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DrawerContent className="h-[92vh] flex flex-col border-gray-700">
          <DrawerHeader className="flex-shrink-0 px-0 pt-0">
            <DrawerTitle className="sr-only">Key Details</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: side sheet
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg p-6 flex flex-col">
        <SheetHeader className="sr-only">
          <SheetTitle>Key Details</SheetTitle>
          <SheetDescription>Details for key {key.pegNumber}</SheetDescription>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}

// Small history entry component
function HistoryEntry({ entry }: { entry: any }) {
  const fieldNameMap: Record<string, string> = {
    'pegNumber': 'Peg Number',
    'siteName': 'Site Name',
    'address': 'Address',
    'contactName': 'Contact Name',
    'contactEmail': 'Contact Email',
    'contactPhone': 'Contact Phone',
    'notes': 'Notes',
  };

  const timeAgo = formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true });

  if (entry.changeType === 'key_created') {
    return (
      <div className="text-xs py-1.5 px-2 rounded bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/30">
        <span className="text-green-700 dark:text-green-400 font-medium">Created</span>
        <span className="text-gray-500 dark:text-gray-400 ml-2">{timeAgo} by {entry.user.name}</span>
      </div>
    );
  }

  if (entry.changeType === 'key_deleted') {
    return (
      <div className="text-xs py-1.5 px-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30">
        <span className="text-red-700 dark:text-red-400 font-medium">Deleted</span>
        <span className="text-gray-500 dark:text-gray-400 ml-2">{timeAgo} by {entry.user.name}</span>
      </div>
    );
  }

  const fieldName = fieldNameMap[entry.field] || entry.field;

  return (
    <div className="text-xs py-1.5 px-2 rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
      <div className="flex items-baseline gap-1 flex-wrap">
        <span className="font-medium text-gray-700 dark:text-gray-300">{fieldName}</span>
        <span className="text-gray-400">changed</span>
        <span className="text-gray-500 dark:text-gray-400">{timeAgo}</span>
        <span className="text-gray-400">by {entry.user.name}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1">
        <span className="text-red-600 dark:text-red-400 line-through">{entry.oldValue || '(empty)'}</span>
        <span className="text-gray-400">&rarr;</span>
        <span className="text-green-600 dark:text-green-400">{entry.newValue || '(empty)'}</span>
      </div>
    </div>
  );
}

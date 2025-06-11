import React from 'react';
import { Id } from "../../../../convex/_generated/dataModel";
import { HoseHistory } from "./HoseHistory";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function HoseHistoryModal({ hoseId, onClose }: { hoseId: Id<"hoses">, onClose: () => void }) {
  // The `Dialog` component itself doesn't need to be explicitly rendered here if this modal
  // is triggered by a `DialogTrigger` from its parent. Assuming `isOpen` and `onOpenChange`
  // are handled by the parent that conditionally renders this modal component.
  // If this modal is self-contained for open/close state, it would need its own `open` state
  // and `onOpenChange` handler for the Dialog.
  // For now, assuming it's controlled externally (like HoseForm was).

  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-6 w-full max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="mb-4 flex-shrink-0">
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">Hose History</DialogTitle>
        </DialogHeader>
        
        <div className="flex-grow overflow-y-auto min-h-0">
          <HoseHistory hoseId={hoseId} />
        </div>
        
        <DialogFooter className="mt-6 flex-shrink-0">
          <DialogClose asChild>
            <Button 
              variant="outline"
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

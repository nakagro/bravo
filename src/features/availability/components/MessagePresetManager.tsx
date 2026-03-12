import React, { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useIsMobile } from "@/hooks/use-mobile";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Plus, X, Check, MessageSquareText, Send } from "lucide-react";

interface MessagePresetManagerProps {
    onClose: () => void;
    onSelectPreset?: (message: string) => void;
}

const MAX_PRESETS = 5;

const MessagePresetManager: React.FC<MessagePresetManagerProps> = ({ onClose, onSelectPreset }) => {
    const isMobile = useIsMobile();
    const presets = useQuery(api.messagePresets.getPresets) || [];
    const createPreset = useMutation(api.messagePresets.createPreset);
    const updatePreset = useMutation(api.messagePresets.updatePreset);
    const deletePreset = useMutation(api.messagePresets.deletePreset);
    const postMessage = useMutation(api.messages.postMessage);

    const [isEditMode, setIsEditMode] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [editingId, setEditingId] = useState<Id<"messagePresets"> | null>(null);
    const [editMessage, setEditMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Auto-enter edit mode if no presets exist
    const effectiveEditMode = isEditMode || presets.length === 0;

    const handleCreate = async () => {
        if (!newMessage.trim()) return;
        setIsSubmitting(true);
        try {
            await createPreset({ message: newMessage.trim() });
            setNewMessage('');
            setIsAdding(false);
        } catch (error) {
            console.error("Error creating preset:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingId || !editMessage.trim()) return;
        setIsSubmitting(true);
        try {
            await updatePreset({ presetId: editingId, message: editMessage.trim() });
            setEditingId(null);
            setEditMessage('');
        } catch (error) {
            console.error("Error updating preset:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (presetId: Id<"messagePresets">) => {
        if (!window.confirm("Delete this quick message?")) return;
        try {
            await deletePreset({ presetId });
            if (editingId === presetId) {
                setEditingId(null);
            }
        } catch (error) {
            console.error("Error deleting preset:", error);
        }
    };

    const handleSendPreset = async (message: string) => {
        if (onSelectPreset) {
            onSelectPreset(message);
            onClose();
            return;
        }

        try {
            await postMessage({ message });
            onClose();
        } catch (error) {
            console.error("Error posting preset message:", error);
        }
    };

    const startEditing = (preset: { _id: Id<"messagePresets">; message: string }) => {
        setEditingId(preset._id);
        setEditMessage(preset.message);
        setIsAdding(false);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditMessage('');
    };

    const cancelAdding = () => {
        setIsAdding(false);
        setNewMessage('');
    };

    const exitEditMode = () => {
        setIsEditMode(false);
        setIsAdding(false);
        setEditingId(null);
        setEditMessage('');
        setNewMessage('');
    };

    // --- SEND MODE: Presets as tappable send buttons ---
    const sendModeContent = (
        <div className="space-y-1.5">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {onSelectPreset ? "Tap a message to insert it into this note." : "Tap a message to post it immediately."}
            </p>
            {presets.map((preset) => (
                <button
                    key={preset._id}
                    type="button"
                    onClick={() => handleSendPreset(preset.message)}
                    className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-sm
            bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200
            hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300
            border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700
            transition-all duration-150 active:scale-[0.98] group"
                >
                    <span className="flex-1 break-words">{preset.message}</span>
                    <Send className="h-3.5 w-3.5 flex-shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-blue-400 dark:group-hover:text-blue-400 transition-colors" />
                </button>
            ))}
        </div>
    );

    // --- EDIT MODE: Add/edit/delete presets ---
    const editModeContent = (
        <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Save up to {MAX_PRESETS} quick messages you use often.
            </p>

            {presets.length === 0 && !isAdding && (
                <div className="text-center py-6">
                    <MessageSquareText className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No quick messages yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add your first one below</p>
                </div>
            )}

            {presets.map((preset, index) => (
                <div
                    key={preset._id}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                >
                    {editingId === preset._id ? (
                        <div className="space-y-2">
                            <Input
                                value={editMessage}
                                onChange={(e) => setEditMessage(e.target.value)}
                                placeholder="Message text"
                                maxLength={150}
                                autoFocus
                                className="text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleUpdate();
                                    if (e.key === 'Escape') cancelEditing();
                                }}
                            />
                            <div className="flex gap-2 justify-end">
                                <Button variant="ghost" size="sm" onClick={cancelEditing} className="h-8">
                                    <X className="h-3.5 w-3.5 mr-1" /> Cancel
                                </Button>
                                <Button size="sm" onClick={handleUpdate} disabled={isSubmitting || !editMessage.trim()} className="h-8">
                                    <Check className="h-3.5 w-3.5 mr-1" /> Save
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium text-gray-400 dark:text-gray-500">#{index + 1}</span>
                                <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 break-words">{preset.message}</p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30" onClick={() => startEditing(preset)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400" onClick={() => handleDelete(preset._id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {isAdding ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800 space-y-2">
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="e.g. Available after 5pm"
                        maxLength={150}
                        autoFocus
                        className="text-sm"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreate();
                            if (e.key === 'Escape') cancelAdding();
                        }}
                    />
                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={cancelAdding} className="h-8">
                            <X className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                        <Button size="sm" onClick={handleCreate} disabled={isSubmitting || !newMessage.trim()} className="h-8">
                            <Check className="h-3.5 w-3.5 mr-1" /> Add
                        </Button>
                    </div>
                </div>
            ) : (
                presets.length < MAX_PRESETS && (
                    <Button variant="outline" size="sm" onClick={() => { setIsAdding(true); cancelEditing(); }} className="w-full h-9 text-sm">
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Add Quick Message ({presets.length}/{MAX_PRESETS})
                    </Button>
                )
            )}
        </div>
    );

    const headerRight = presets.length > 0 ? (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => effectiveEditMode ? exitEditMode() : setIsEditMode(true)}
            className="h-8 text-xs"
        >
            {effectiveEditMode ? (
                <>Done Editing</>
            ) : (
                <><Pencil className="h-3 w-3 mr-1" /> Edit</>
            )}
        </Button>
    ) : null;

    const formFooter = (
        <div className="flex gap-3 p-4 pb-8 md:pb-4 border-t border-gray-200 dark:border-gray-700 bg-background">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12 text-base">
                Close
            </Button>
        </div>
    );

    const activeContent = effectiveEditMode ? editModeContent : sendModeContent;

    // Mobile: Drawer sliding up from bottom
    if (isMobile) {
        return (
            <Drawer open onOpenChange={(open) => { if (!open) onClose(); }}>
                <DrawerContent className="max-h-[85vh] flex flex-col border-gray-700">
                    <DrawerHeader className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 pb-4">
                        <div className="flex items-center justify-between">
                            <DrawerTitle className="text-xl font-bold">
                                {onSelectPreset ? "Quick Notes" : "Quick Messages"}
                            </DrawerTitle>
                            {headerRight}
                        </div>
                    </DrawerHeader>
                    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
                        {activeContent}
                    </div>
                    <DrawerFooter className="flex-shrink-0 p-0">
                        {formFooter}
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        );
    }

    // Desktop: Dialog
    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 dark:border-gray-700">
                <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-xl font-bold">
                            {onSelectPreset ? "Quick Notes" : "Quick Messages"}
                        </DialogTitle>
                        {headerRight}
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4">
                    {activeContent}
                </div>
                <div className="flex-shrink-0">
                    {formFooter}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default MessagePresetManager;

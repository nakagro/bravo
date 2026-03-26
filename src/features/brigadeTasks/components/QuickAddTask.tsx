import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Send, LoaderCircle } from "lucide-react";

interface QuickAddTaskProps {
    quickAddText: string;
    isQuickAdding: boolean;
    onTextChange: (text: string) => void;
    onSubmit: () => void;
}

export function QuickAddTask({
    quickAddText,
    isQuickAdding,
    onTextChange,
    onSubmit
}: QuickAddTaskProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="relative">
            <Input
                ref={inputRef}
                value={quickAddText}
                onChange={(e) => onTextChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        onSubmit();
                    }
                }}
                placeholder="Quick add a task... (press Enter)"
                className="pr-12 h-12 text-base bg-white dark:bg-gray-900 shadow-sm border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
            <button
                onClick={onSubmit}
                disabled={!quickAddText.trim() || isQuickAdding}
                className={`
                    absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all
                    ${quickAddText.trim()
                        ? "bg-red-500 text-white hover:bg-red-600 shadow-sm"
                        : "text-gray-400 cursor-not-allowed"
                    }
                `}
            >
                {isQuickAdding ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                    <Send className="h-5 w-5" />
                )}
            </button>
        </div>
    );
}

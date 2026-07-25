import { ReactNode, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableRowProps {
  id: string;
  /** Announced when the row is picked up with a keyboard. */
  label: string;
  children: ReactNode;
  /** Overflow menu, action buttons; rendered to the right of the content. */
  actions?: ReactNode;
}

function SortableRow({ id, label, children, actions }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-2",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
    >
      <button
        type="button"
        aria-label={`Reorder ${label}`}
        className="flex size-11 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
      {actions}
    </li>
  );
}

interface KitSortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  renderRow: (item: T, index: number, total: number) => ReactNode;
  renderActions?: (item: T, index: number, total: number) => ReactNode;
  /** Receives the full reordered id list, matching the backend's reorder args. */
  onReorder: (ids: string[]) => void;
  className?: string;
}

/**
 * Drag reorder that never *only* works by dragging: pointer and keyboard
 * sensors both work, moves are announced, and every row's overflow menu is
 * expected to also carry Move up / Move down (see `moveHelpers` below).
 */
export function KitSortableList<T>({
  items,
  getId,
  getLabel,
  renderRow,
  renderActions,
  onReorder,
  className,
}: KitSortableListProps<T>) {
  const [announcement, setAnnouncement] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = items.map(getId);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    const next = arrayMove(ids, from, to);
    const moved = items.find((item) => getId(item) === String(active.id));
    setAnnouncement(
      `${moved ? getLabel(moved) : "Item"} moved to position ${to + 1} of ${ids.length}.`,
    );
    onReorder(next);
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
          <ul className={cn("space-y-2", className)}>
            {items.map((item, index) => (
              <SortableRow
                key={getId(item)}
                id={getId(item)}
                label={getLabel(item)}
                actions={renderActions?.(item, index, items.length)}
              >
                {renderRow(item, index, items.length)}
              </SortableRow>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}

/** Move one id up or down, producing the full list the reorder mutations want. */
export function movedIds(ids: string[], index: number, direction: -1 | 1): string[] {
  const target = index + direction;
  if (target < 0 || target >= ids.length) return ids;
  return arrayMove(ids, index, target);
}

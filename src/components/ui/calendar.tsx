import * as React from "react";
import { DayPicker } from "@daypicker/react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-full p-3", className)}
      classNames={{
        months: "relative flex flex-col gap-4",
        month: "flex w-full flex-col gap-4",
        // Leave horizontal room (mx-10) for the absolutely-positioned nav arrows
        month_caption: "relative mx-10 flex h-9 items-center justify-center",
        caption_label: "flex items-center gap-1 text-sm font-medium",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-9 w-9 p-0 select-none"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-9 w-9 p-0 select-none"
        ),
        // Native month / year dropdowns: a styled box with the real <select>
        // overlaid at 0 opacity, so mobile gets the native picker on tap.
        dropdowns: "flex items-center justify-center gap-1.5",
        dropdown_root:
          "relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 focus-within:ring-2 focus-within:ring-red-500",
        dropdown: "absolute inset-0 h-full w-full cursor-pointer opacity-0",
        month_grid: "w-full border-collapse",
        weekdays: "flex w-full",
        weekday:
          "flex-1 text-muted-foreground font-normal text-[0.8rem] pb-1",
        week: "flex w-full mt-1.5",
        day: cn(
          "relative flex-1 aspect-square p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:rounded-md"
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-full w-full p-0 font-normal aria-selected:opacity-100"
        ),
        selected:
          "bg-red-600 text-white hover:bg-red-600 hover:text-white focus:bg-red-600 focus:text-white dark:bg-red-600 dark:text-white",
        today: "bg-accent text-accent-foreground rounded-md",
        outside:
          "day-outside text-muted-foreground aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") return <ChevronLeft className="h-4 w-4" />;
          if (orientation === "right") return <ChevronRight className="h-4 w-4" />;
          return <ChevronDown className="h-3.5 w-3.5 text-gray-400" />;
        },
        // Merged, not replaced, so a caller's custom DayButton keeps the chevrons.
        ...components,
      }}
      {...props}
    />
  );
}

export { Calendar };

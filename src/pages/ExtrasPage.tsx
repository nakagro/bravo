import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type ExtraLink = {
  title: string;
  description: string;
  to: string;
  emoji?: string;
  /** If set, the link is only shown when the user has access to this module */
  moduleId?: string;
};

const EXTRA_LINKS: ExtraLink[] = [
  {
    title: "D14 Contact List",
    description: "Searchable District 14 emergency contacts — mobile-friendly version of the kiosk directory.",
    to: "/contacts",
    emoji: "📇",
  },
  {
    title: "Fire Danger Ratings",
    description: "All regions Fire Danger Ratings and Total Fire Ban status in one view.",
    to: "/fdr",
    emoji: "🔥",
  },
  {
    title: "Equipment",
    description: "Track and manage equipment stock levels.",
    to: "/equipment",
    emoji: "",
    moduleId: "equipment",
  },
  {
    title: "Brigade Tasks",
    description: "Track your personal todo list and brigade activities.",
    to: "/brigade-tasks",
    emoji: "📋",
    moduleId: "brigadeTasks",
  },
  {
    title: "Kiosk Mode",
    description: "Touch-friendly dashboard for the station kiosk.",
    to: "/kiosk",
    emoji: "🖥️",
    moduleId: "kiosk",
  },
  {
    title: "Automation Shortcuts",
    description: "Generate a secure URL to automate your availability status.",
    to: "/shortcuts",
    emoji: "⚡",
  },
];

export default function ExtrasPage() {
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);

  // Filter links based on module access (links without a moduleId are always visible)
  const visibleLinks = EXTRA_LINKS.filter((link) => {
    if (!link.moduleId) return true;
    if (!moduleAccess) return false; // hide until loaded
    return moduleAccess[link.moduleId as keyof typeof moduleAccess] ?? false;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Extras</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        A tucked-away collection of pages being tested.
      </p>

      <div className="grid gap-4">
        {visibleLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="group rounded-xl border border-border bg-card/60 hover:bg-card transition-colors shadow-sm"
          >
            <div className="p-5 flex items-center gap-4">
              {link.emoji && (
                <div className="text-2xl">
                  {link.emoji}
                </div>
              )}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{link.title}</h2>
                  <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {link.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
        {visibleLinks.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-6 text-center text-muted-foreground">
            More coming soon.
          </div>
        )}
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

type ExtraLink = {
  title: string;
  description: string;
  to: string;
  emoji?: string;
};

const EXTRA_LINKS: ExtraLink[] = [
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
    emoji: "🧤",
  },
];

export default function ExtrasPage() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Extras</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        A tucked-away collection of pages being tested.
      </p>

      <div className="grid gap-4">
        {EXTRA_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="group rounded-xl border border-border bg-card/60 hover:bg-card transition-colors shadow-sm"
          >
            <div className="p-5 flex items-center gap-4">
              <div className="text-2xl">
                {link.emoji ?? "✨"}
              </div>
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
        {EXTRA_LINKS.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-6 text-center text-muted-foreground">
            More coming soon.
          </div>
        )}
      </div>
    </div>
  );
}

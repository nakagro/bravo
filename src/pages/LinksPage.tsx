import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ExternalLink } from "lucide-react";

export function LinksPage() {
  const links = useQuery(api.links.getActiveLinks);

  if (links === undefined) {
    return (
      <div className="p-4">
        <div className="animate-pulse text-muted-foreground">Loading links…</div>
      </div>
    );
  }

  if (!links || links.length === 0) {
    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No links have been added yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group by category
  const groups = links.reduce<Record<string, typeof links>>((acc, link) => {
    const key = link.category || "General";
    acc[key] = acc[key] || [];
    acc[key].push(link);
    return acc;
  }, {});

  const categories = Object.keys(groups).sort();

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Links</h1>
      {categories.map((cat, idx) => (
        <div key={cat} className="space-y-3">
          {idx > 0 && <Separator />}
          <h2 className="text-lg font-medium text-muted-foreground">{cat}</h2>
          
          {/* Compact list view for mobile, card grid for larger screens */}
          <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3">
            {groups[cat].map((link) => (
              <a
                key={link._id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                {/* Mobile: Compact list item */}
                <div className="sm:hidden flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors">
                  {link.icon && (
                    <span className="text-2xl flex-shrink-0" aria-hidden>
                      {link.icon}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{link.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{link.url}</div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Desktop: Card view */}
                <Card className="hidden sm:block hover:bg-accent/40 transition-colors h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base truncate flex items-center gap-2">
                      {link.icon && <span aria-hidden>{link.icon}</span>}
                      <span className="truncate">{link.title}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground truncate">{link.url}</p>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

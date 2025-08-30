import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
          <h2 className="text-xl font-medium">{cat}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups[cat].map((link) => (
              <a
                key={link._id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Card className="hover:bg-accent/40 transition-colors">
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

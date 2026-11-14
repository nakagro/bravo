import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ExternalLink, Link2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/shared/EmptyState";

export function LinksPage() {
  const links = useQuery(api.links.getActiveLinks);

  // Loading state with consistent layout
  if (links === undefined) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Links</h1>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner className="text-muted-foreground" />
          <span>Loading links…</span>
        </div>
      </div>
    );
  }

  // Empty state with consistent layout
  if (!links || links.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Links</h1>
        </div>
        <EmptyState
          icon={<Link2 />}
          title="No links yet"
          description="Links will appear here once they've been added to the system."
        />
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

  const categories = Object.keys(groups).sort((a, b) => {
    const aOrder = Number(links.find((link) => (link.category || "General") === a)?.categoryOrder ?? Number.MAX_SAFE_INTEGER);
    const bOrder = Number(links.find((link) => (link.category || "General") === b)?.categoryOrder ?? Number.MAX_SAFE_INTEGER);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Links</h1>
      </div>

      <Accordion type="multiple" defaultValue={categories} className="space-y-2">
        {categories.map((cat, idx) => (
          <AccordionItem key={cat} value={cat} className="border-none">
            {idx > 0 && <Separator className="mb-3" />}

            {/* Category header */}
            <AccordionTrigger className="text-lg font-semibold text-gray-800 dark:text-gray-200 hover:no-underline hover:text-gray-900 dark:hover:text-gray-100 py-1">
              {cat}
            </AccordionTrigger>

            <AccordionContent className="pt-1">
              {/* Responsive grid */}
              <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
                {groups[cat].map((link) => (
                  <a
                    key={link._id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    {/* Mobile: Enhanced compact list item */}
                    <div className="sm:hidden flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-card hover:bg-accent/50 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200">
                      {link.icon && (
                        <span className="text-2xl flex-shrink-0" aria-hidden="true">
                          {link.icon}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-gray-900 dark:text-gray-100">
                          {link.title}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {link.url}
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </div>

                    {/* Desktop: Enhanced card view */}
                    <Card className="hidden sm:flex sm:flex-col h-full border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all duration-200 group-hover:scale-[1.02]">
                      <CardHeader className="pb-3 flex-1">
                        <CardTitle className="text-base flex items-center gap-2 group-hover:text-primary transition-colors">
                          {link.icon && (
                            <span className="text-xl" aria-hidden="true">
                              {link.icon}
                            </span>
                          )}
                          <span className="truncate">{link.title}</span>
                        </CardTitle>
                        {(link as any).description && (
                          <CardDescription className="text-xs line-clamp-2 mt-1">
                            {(link as any).description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{link.url}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getVersionString } from "@/utils/version";
import { Badge } from "@/components/ui/badge";
import changelogData from "../../changelog.json";

interface ChangelogEntry {
  version: string;
  message: string;
  date: string;
  timestamp: number;
}

export default function AboutPage() {
  const changelog = changelogData as ChangelogEntry[];
  
  // Format date to be more readable
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Extract type from commit message (feat, fix, refactor, etc.)
  const getCommitType = (message: string) => {
    const match = message.match(/^(feat|fix|refactor|docs|style|test|chore|perf):/i);
    return match ? match[1].toLowerCase() : null;
  };
  
  // Get badge variant based on commit type
  const getBadgeVariant = (type: string | null): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case 'feat': return 'default';
      case 'fix': return 'destructive';
      case 'refactor': return 'secondary';
      default: return 'outline';
    }
  };
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* About Section */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-5xl mb-4">
              <span className="font-bold bg-gradient-to-r from-red-700 to-orange-400 bg-clip-text text-transparent">
                BRAVO
              </span>
            </CardTitle>
            <CardDescription className="text-lg font-medium text-gray-700 dark:text-gray-300">
              <span className="text-orange-600 dark:text-orange-500 font-semibold">BR</span>igade{" "}
              <span className="text-orange-600 dark:text-orange-500 font-semibold">AV</span>ailability and{" "}
              <span className="text-orange-600 dark:text-orange-500 font-semibold">O</span>perations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              BRAVO is a passion project by Shaun Gordon, 
              originally made for the Wyndham Vale Fire Brigade. This brigade management 
              system aims to streamline operations, track availability, manage equipment, and coordinate 
              emergency response activities.

              Made with modern web technologies 
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-semibold">Current Version:</span>
              <span className="font-mono bg-muted px-2 py-1 rounded">v{getVersionString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Changelog Section */}
        <Card>
          <CardHeader>
            <CardTitle>Changelog</CardTitle>
          </CardHeader>
          <CardContent>
            {changelog.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No changelog entries yet. Commit messages will appear here automatically.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {changelog.map((entry, index) => {
                  const commitType = getCommitType(entry.message);
                  const messageWithoutType = commitType 
                    ? entry.message.replace(/^(feat|fix|refactor|docs|style|test|chore|perf):\s*/i, '')
                    : entry.message;
                  
                  return (
                    <div 
                      key={`${entry.version}-${entry.timestamp}`}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-shrink-0 pt-0.5">
                        <Badge variant={getBadgeVariant(commitType)} className="font-mono text-xs">
                          v{entry.version}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          {commitType && (
                            <Badge variant="outline" className="text-xs">
                              {commitType}
                            </Badge>
                          )}
                          <p className="text-sm flex-1 min-w-0">
                            {messageWithoutType}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(entry.date)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

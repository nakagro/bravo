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
  
  // Format date to be more readable (date only, no time)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
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
    <div className="min-h-screen">
      {/* About Section */}
      <div className="text-center py-8 px-4">
        <h1 className="text-5xl mb-4">
          <span className="font-bold bg-gradient-to-r from-red-700 to-orange-400 bg-clip-text text-transparent">
            BRAVO
          </span>
        </h1>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-6">
          <span className="text-orange-600 dark:text-orange-500 font-semibold">BR</span>igade{" "}
          <span className="text-orange-600 dark:text-orange-500 font-semibold">AV</span>ailability and{" "}
          <span className="text-orange-600 dark:text-orange-500 font-semibold">O</span>perations
        </p>
        
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            BRAVO is a passion project by Shaun Gordon, originally made for the Wyndham Vale Fire Brigade
            designed to help streamline brigade operations.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold">Current Version:</span>
            <span className="font-mono bg-muted px-2 py-1 rounded">v{getVersionString()}</span>
          </div>
        </div>
      </div>

      {/* Changelog Section */}
      <div className="px-4 pb-8">
        <h2 className="text-2xl font-bold mb-4">Changelog</h2>
        <div>
            {changelog.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No changelog entries yet. Commit messages will appear here automatically.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {changelog.map((entry, index) => {
                  const commitType = getCommitType(entry.message);
                  const messageWithoutType = commitType 
                    ? entry.message.replace(/^(feat|fix|refactor|docs|style|test|chore|perf):\s*/i, '')
                    : entry.message;
                  
                  return (
                    <div 
                      key={`${entry.version}-${entry.timestamp}`}
                      className="p-3 rounded-lg border border-border"
                    >
                      {/* Version, Type, and Date on first line */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant={getBadgeVariant(commitType)} className="font-mono text-xs">
                          v{entry.version}
                        </Badge>
                        {commitType && (
                          <Badge variant="outline" className="text-xs">
                            {commitType}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDate(entry.date)}
                        </span>
                      </div>
                      
                      {/* Message on second line */}
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {messageWithoutType}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

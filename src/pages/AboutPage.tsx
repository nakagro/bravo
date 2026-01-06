import { getVersionString } from "@/utils/version";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import changelogMd from '../../CHANGELOG.md?raw';
import { Link } from "react-router-dom";

export default function AboutPage() {
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
            A passion project created by Shaun Gordon, originally created for the Wyndham Vale Fire Brigade
            designed to help streamline brigade operations.
          </p>
      <div className="text-center">
        <Link 
          to="/extras" 
          className="text-2xl opacity-50 hover:opacity-100 transition-opacity"
        >
          🔥
        </Link>
      </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold">Current Version:</span>
            <span className="font-mono bg-muted px-2 py-1 rounded">v{getVersionString()}</span>
          </div>
        </div>
      </div>

      {/* Changelog Section */}
      <div className="px-4 pb-8 max-w-3xl mx-auto">
        {/* <div className="bg-card rounded-xl border border-border shadow-sm p-6 md:p-8"> */}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ ...props }) => <h1 className="text-3xl font-bold mb-4 text-foreground border-b pb-2" {...props} />,
            h2: ({ ...props }) => {
              // Attempt to extract text content to parse version/date
              const text = typeof props.children === 'string'
                ? props.children
                : Array.isArray(props.children)
                  ? props.children.map(child => typeof child === 'string' ? child : '').join('')
                  : String(props.children || '');

              // Match format: [Version] - Date
              // e.g. [1.0.32] - 2025-11-15
              const match = text.match(/^\[(.*?)\]\s*-\s*(.*)$/);

              if (match) {
                const [, version, dateStr] = match;
                let formattedDate = dateStr;
                try {
                  formattedDate = new Date(dateStr).toLocaleDateString('en-AU', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  });
                } catch (e) {
                  // Keep original if parsing fails
                }

                return (
                  <div className="mt-6 mb-3 flex items-center justify-between pb-2 border-b border-border/50 first:mt-0">
                    <Badge variant="default" className="text-sm px-3 py-1 h-7 font-mono">
                      v{version}
                    </Badge>
                    <span className="text-sm text-muted-foreground font-medium">
                      {formattedDate}
                    </span>
                  </div>
                );
              }

              return (
                <div className="mt-6 mb-3 flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-foreground" {...props} />
                </div>
              );
            },
            h3: ({ ...props }) => <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground" {...props} />,
            ul: ({ ...props }) => <ul className="space-y-1 mb-2" {...props} />,
            li: ({ ...props }) => (
              <li className="flex gap-3 text-muted-foreground text-sm leading-relaxed group" {...props}>
                <span className="text-primary/60 mt-1.5 h-1.5 w-1.5 rounded-full bg-current shrink-0 group-hover:text-primary transition-colors" />
                <span className="group-hover:text-foreground transition-colors">{props.children}</span>
              </li>
            ),
            p: ({ ...props }) => <p className="text-muted-foreground mb-2 leading-relaxed" {...props} />,
            a: ({ ...props }) => <a className="text-primary hover:underline font-medium" {...props} />,
            blockquote: ({ ...props }) => <blockquote className="border-l-4 border-primary/20 pl-4 italic text-muted-foreground my-4" {...props} />,
            code: ({ ...props }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground" {...props} />,
          }}
        >
          {changelogMd}
        </ReactMarkdown>
        {/* </div> */}
      </div>

      {/* Sneaky footer */}
      <div className="text-center pb-8">
        <Link 
          to="/extras" 
          className="text-2xl opacity-50 hover:opacity-100 transition-opacity"
        >
          🔥
        </Link>
      </div>
    </div>
  );
}

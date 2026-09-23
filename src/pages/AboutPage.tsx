import { useState, type ReactNode } from "react";
import { getVersionString } from "@/utils/version";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import changelogMd from '../../CHANGELOG.md?raw';
import { Link } from "react-router-dom";

const CHANGELOG_HEADING_PATTERN = /^\[(.*?)\](?:\s*-\s*(.*))?$/;
const DATE_VERSION_PATTERN = /^\d{4}\.\d{2}\.\d{2}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RELEASE_HEADING_PATTERN = /^## \[/gm;
const VISIBLE_RELEASES = 10;

// Split the changelog after the first VISIBLE_RELEASES release headings, so
// older entries can sit behind a "Show older updates" button.
const splitChangelog = (markdown: string): [string, string] => {
  const headingStarts = [...markdown.matchAll(RELEASE_HEADING_PATTERN)].map(m => m.index ?? 0);
  if (headingStarts.length <= VISIBLE_RELEASES) return [markdown, ''];
  const cut = headingStarts[VISIBLE_RELEASES];
  return [markdown.slice(0, cut), markdown.slice(cut)];
};

const [recentChangelog, olderChangelog] = splitChangelog(changelogMd);

const extractTextContent = (children: ReactNode): string => {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) {
    return children.map(child => typeof child === 'string' ? child : '').join('');
  }
  return String(children || '');
};

const getIsoDateFromVersion = (version: string): string | null => {
  if (!DATE_VERSION_PATTERN.test(version)) return null;
  return version.replace(/\./g, '-');
};

const formatDisplayDate = (dateStr: string): string => {
  if (ISO_DATE_PATTERN.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  const parsedDate = new Date(dateStr);
  if (Number.isNaN(parsedDate.getTime())) {
    return dateStr;
  }

  return parsedDate.toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const markdownComponents: Components = {
  h1: ({ ...props }) => <h1 className="text-3xl font-bold mb-4 text-foreground border-b pb-2" {...props} />,
  h2: ({ ...props }) => {
    const text = extractTextContent(props.children);
    const match = text.match(CHANGELOG_HEADING_PATTERN);

    if (match) {
      const [, version, explicitDate = ''] = match;
      const versionAsDate = getIsoDateFromVersion(version);
      const resolvedDate = explicitDate.trim() || versionAsDate || '';
      const isDateBasedVersion = Boolean(versionAsDate && (!explicitDate.trim() || explicitDate.trim() === versionAsDate));
      const formattedDate = resolvedDate ? formatDisplayDate(resolvedDate) : '';

      if (isDateBasedVersion && formattedDate) {
        return (
          <div className="mt-6 mb-3 pb-2 border-b border-border/50 first:mt-0">
            <h2 className="text-xl font-semibold text-foreground">{formattedDate}</h2>
          </div>
        );
      }

      return (
        <div className="mt-6 mb-3 flex items-center justify-between pb-2 border-b border-border/50 first:mt-0">
          <Badge variant="default" className="text-sm px-3 py-1 h-7 font-mono">
            v{version}
          </Badge>
          {formattedDate ? (
            <span className="text-sm text-muted-foreground font-medium">
              {formattedDate}
            </span>
          ) : null}
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
};

export default function AboutPage() {
  const [showOlder, setShowOlder] = useState(false);

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
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {recentChangelog}
        </ReactMarkdown>
        {olderChangelog && (showOlder ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {olderChangelog}
          </ReactMarkdown>
        ) : (
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={() => setShowOlder(true)}>
              Show older updates
            </Button>
          </div>
        ))}
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

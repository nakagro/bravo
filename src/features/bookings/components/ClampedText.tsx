import { useState } from "react";

const CLAMP_THRESHOLD = 140;

/**
 * Text block that clamps to two lines with a Show more toggle when long,
 * matching the notes treatment on BA Skills record cards.
 */
export function ClampedText({ text, className = "" }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > CLAMP_THRESHOLD;

  return (
    <div>
      <p
        className={`whitespace-pre-wrap ${className} ${isLong && !expanded ? "line-clamp-2" : ""}`}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

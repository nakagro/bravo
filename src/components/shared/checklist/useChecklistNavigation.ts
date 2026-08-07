import { useCallback, useEffect, useRef, useState } from "react";

export interface ChecklistNavSection {
  /** Stable key — also the Accordion item value. */
  key: string;
  answered: number;
  total: number;
}

interface UseChecklistNavigationOptions {
  sections: ChecklistNavSection[];
  /**
   * Open and scroll to the next incomplete section when one finishes.
   * Inventory wants this; Duty Crew's much shorter list doesn't.
   */
  autoAdvance?: boolean;
}

/**
 * Section open state, section refs and optional auto-advance for a checklist.
 * One implementation for both modules — this logic had drifted into two.
 */
export function useChecklistNavigation({
  sections,
  autoAdvance = false,
}: UseChecklistNavigationOptions) {
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const [openSections, setOpenSections] = useState<string[]>([]);
  const initialised = useRef(false);
  const prevAnsweredRef = useRef(new Map<string, number>());

  // Sections start expanded; collapsing is an escape hatch, not the norm.
  useEffect(() => {
    if (initialised.current || sections.length === 0) return;
    initialised.current = true;
    setOpenSections(sections.map((s) => s.key));
  }, [sections]);

  const registerSectionRef = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) sectionRefs.current.set(key, el);
      else sectionRefs.current.delete(key);
    },
    [],
  );

  const openSection = useCallback((key: string) => {
    setOpenSections((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, []);

  // Auto-advance: when a section completes, open and scroll the next one that
  // still has work in it.
  useEffect(() => {
    if (!autoAdvance || sections.length === 0) return;

    for (const section of sections) {
      const prevAnswered = prevAnsweredRef.current.get(section.key);
      const justCompleted =
        section.total > 0 &&
        section.answered === section.total &&
        prevAnswered !== undefined &&
        prevAnswered < section.total;

      if (justCompleted) {
        const index = sections.indexOf(section);
        const next = sections.slice(index + 1).find((s) => s.answered < s.total);
        if (next) {
          openSection(next.key);
          setTimeout(() => {
            sectionRefs.current
              .get(next.key)
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 200);
        }
      }

      prevAnsweredRef.current.set(section.key, section.answered);
    }
  }, [autoAdvance, openSection, sections]);

  return {
    registerSectionRef,
    openSections,
    setOpenSections,
  };
}

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { FDR_LEVELS, fdrAppearance } from "./fdrLevels";

const CFA_BANS = "https://www.cfa.vic.gov.au/warnings-and-restrictions/fire-bans-ratings-and-restrictions";

const CHECK_LINKS = [
  {
    href: `${CFA_BANS}/total-fire-bans-fire-danger-ratings`,
    title: "CFA: Total Fire Bans and Fire Danger Ratings",
    body: "The official Victorian display of today's ratings and bans for every district.",
  },
  {
    href: `${CFA_BANS}/total-fire-bans-fire-danger-ratings/central-fire-district`,
    title: "CFA: Central fire district",
    body: "Our district's four-day outlook on its own page.",
  },
  {
    href: "https://www.emergency.vic.gov.au/respond/",
    title: "VicEmergency",
    body: "Live warnings and incidents across Victoria.",
  },
];

const LEARN_LINKS = [
  {
    href: "https://www.afdrs.com.au/",
    title: "Australian Fire Danger Rating System",
    body: "How the national rating system works and what each level asks you to do.",
  },
  {
    href: `${CFA_BANS}/about-fire-danger-ratings`,
    title: "CFA: About fire danger ratings",
    body: "The Victorian guide to the ratings.",
  },
  {
    href: `${CFA_BANS}/can-i-or-cant-i/can-i-or-cant-i`,
    title: "CFA: Can I or can't I?",
    body: "What you can and can't do during the Fire Danger Period and on Total Fire Ban days.",
  },
  {
    href: "https://www.bom.gov.au/resources/learn-and-explore/fire-weather-knowledge-centre",
    title: "Bureau of Meteorology: Fire weather knowledge centre",
    body: "How weather drives fire behaviour and how the forecasts are made.",
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function LinkList({ links }: { links: typeof CHECK_LINKS }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-3 transition-colors hover:bg-muted/60"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{link.title}</p>
              <p className="text-xs text-muted-foreground">{link.body}</p>
            </div>
            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}

interface FdrAboutSheetProps {
  open: boolean;
  onClose: () => void;
  issueTime?: string;
}

export function FdrAboutSheet({ open, onClose, issueTime }: FdrAboutSheetProps) {
  return (
    <ResponsiveModal open={open} onClose={onClose} title="About this data">
      <div className="space-y-6 pb-6">
        <Section title="What the ratings mean">
          <ul className="space-y-2">
            {FDR_LEVELS.map((level) => {
              const look = fdrAppearance(level.key);
              return (
                <li key={level.key} className="flex items-start gap-3">
                  <span
                    className={`w-28 shrink-0 rounded px-2 py-1 text-center text-xs font-semibold ${look.className}`}
                    style={look.style}
                  >
                    {level.label}
                    <span className="block text-[10px] font-normal opacity-80">FBI {level.fbi}</span>
                  </span>
                  <p className="pt-0.5 text-sm text-foreground">{level.action}</p>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            FBI is the Fire Behaviour Index: how hard a fire would be to control on the day, worked
            out from the weather and the fuel in the landscape.
          </p>
        </Section>

        <Section title="Where it comes from">
          <div className="space-y-2 text-sm text-foreground">
            <p>
              <span className="font-medium">Ratings:</span> the Bureau of Meteorology's Victorian fire
              danger forecast (product IDV18555), four days for each of the nine fire districts.
              {issueTime ? ` This one was issued ${issueTime}.` : ""}
            </p>
            <p>
              <span className="font-medium">Total Fire Bans:</span> declared by the CFA and published
              through Emergency Management Victoria.
            </p>
            <p className="text-muted-foreground">
              BRAVO reads both through the brigade's data service and refreshes every 30 minutes. If
              anything here disagrees with the official sites below, trust the official sites.
            </p>
          </div>
        </Section>

        <Section title="Check it yourself">
          <LinkList links={CHECK_LINKS} />
        </Section>

        <Section title="Learn more">
          <LinkList links={LEARN_LINKS} />
        </Section>
      </div>
    </ResponsiveModal>
  );
}

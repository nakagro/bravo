import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
    ArrowLeft,
    ChevronRight,
    Home,
    Mail,
    Phone,
    Search,
    X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    formatCount,
    formatPageRange,
    getNodeSummary,
    getNodeTrail,
    getSearchResults,
    loadContactDirectory,
    type ContactCard,
    type ContactDirectoryIndex,
    type ContactMethods,
    type ContactNode,
    type ContactRecord,
    type VehicleRecord,
} from "@/features/kiosk/contactDirectoryData";

/**
 * Mobile-friendly D14 Contact List.
 *
 * Shares its data layer (loader/index/search) with the full-screen kiosk view
 * (features/kiosk/KioskContactDirectory) but renders inside the normal app
 * layout: theme-aware, scrollable, selectable text, and with tappable
 * tel:/mailto: links so it works well on a phone.
 */

/**
 * Renders the phones / emails / websites of a contact_methods block.
 *
 * NOTE: these were previously rendered as tappable tel:/mailto: pills, but that
 * cluttered the mobile layout, so for now they're shown as plain text lines with
 * a small leading icon. (Re-introduce links here when we revisit the design.)
 */
function ContactMethodLines({ methods }: { methods?: ContactMethods }) {
    const phones = methods?.phones ?? [];
    const emails = methods?.emails ?? [];
    const websites = methods?.websites ?? [];

    if (!phones.length && !emails.length && !websites.length) {
        return null;
    }

    return (
        <div className="space-y-1 text-sm text-muted-foreground">
            {phones.map((phone) => (
                <div key={`p-${phone}`} className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{phone}</span>
                </div>
            ))}
            {emails.map((email) => (
                <div key={`e-${email}`} className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="break-all">{email}</span>
                </div>
            ))}
            {websites.map((site) => (
                <div key={`w-${site}`} className="break-all pl-[1.375rem]">
                    {site}
                </div>
            ))}
        </div>
    );
}

function DetailLines({ lines }: { lines: string[] }) {
    return (
        <div className="space-y-1 text-sm text-muted-foreground leading-relaxed">
            {lines.map((line, index) => (
                <p key={`${line}-${index}`}>{line}</p>
            ))}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
            </h2>
            {children}
        </div>
    );
}

/** A tappable drill-down row used for child sections and search results. */
function NavRow({
    title,
    subtitle,
    onClick,
}: {
    title: string;
    subtitle?: string | null;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent/50 hover:border-foreground/20 active:bg-accent"
        >
            <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground">{title}</div>
                {subtitle ? (
                    <div className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</div>
                ) : null}
            </div>
            <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        </button>
    );
}

function ContactCardItem({ card }: { card: ContactCard }) {
    return (
        <Card>
            <CardContent className="space-y-3 p-4">
                {card.title ? (
                    <h3 className="font-semibold text-foreground">{card.title}</h3>
                ) : null}
                {card.display_lines?.length ? <DetailLines lines={card.display_lines} /> : null}
                <ContactMethodLines methods={card.contact_methods} />
            </CardContent>
        </Card>
    );
}

function ContactPersonItem({ contact }: { contact: ContactRecord }) {
    return (
        <Card>
            <CardContent className="space-y-2 p-4">
                {contact.role ? (
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {contact.role}
                    </p>
                ) : null}
                <h3 className="font-semibold text-foreground">{contact.name || "Unnamed Contact"}</h3>
                {contact.address_lines?.length ? <DetailLines lines={contact.address_lines} /> : null}
                <ContactMethodLines
                    methods={{ phones: contact.phones, emails: contact.emails }}
                />
                {contact.notes?.length ? (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
                        {contact.notes.join(" ")}
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}

function VehicleItem({ vehicle }: { vehicle: VehicleRecord }) {
    return (
        <Card>
            <CardContent className="space-y-2 p-4">
                <h3 className="font-semibold text-foreground">{vehicle.name}</h3>
                {vehicle.phone ? (
                    <ContactMethodLines methods={{ phones: [vehicle.phone] }} />
                ) : (
                    <p className="text-sm text-muted-foreground">Phone not confirmed</p>
                )}
                {vehicle.notes?.length ? (
                    <p className="text-sm text-muted-foreground">{vehicle.notes.join(" ")}</p>
                ) : null}
            </CardContent>
        </Card>
    );
}

export default function ContactDirectoryPage() {
    const [directory, setDirectory] = useState<ContactDirectoryIndex | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        let cancelled = false;

        loadContactDirectory()
            .then((loaded) => {
                if (cancelled) return;
                setDirectory(loaded);
                setLoadError(null);
            })
            .catch((error) => {
                if (cancelled) return;
                setLoadError(
                    error instanceof Error ? error.message : "Unable to load contact directory.",
                );
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

    const currentNode =
        currentNodeId && directory ? directory.nodeById.get(currentNodeId) ?? null : null;

    const trail = useMemo(
        () =>
            currentNodeId && directory
                ? getNodeTrail(currentNodeId, directory.nodeById, directory.parentById)
                : [],
        [currentNodeId, directory],
    );
    const breadcrumbNodes = trail.slice(0, -1);

    const searchResults = useMemo(
        () =>
            deferredSearchQuery && directory
                ? getSearchResults(deferredSearchQuery, directory.searchEntries, directory.nodeById)
                : [],
        [deferredSearchQuery, directory],
    );

    const rootMenuItems = directory?.rootMenuItems ?? [];

    const openNode = (nodeId: string) => {
        startTransition(() => {
            setCurrentNodeId(nodeId);
            setSearchQuery("");
        });
        window.scrollTo({ top: 0 });
    };

    const goBack = () => {
        if (!currentNodeId) return;
        const parentId = directory?.parentById.get(currentNodeId) ?? null;
        startTransition(() => setCurrentNodeId(parentId));
    };

    const goHome = () => {
        startTransition(() => {
            setCurrentNodeId(null);
            setSearchQuery("");
        });
    };

    const childNodes = currentNode?.children ?? [];

    return (
        <div className="space-y-4">
            {/* Title + navigation */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    {currentNodeId ? (
                        <button
                            onClick={goBack}
                            className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            aria-label="Back to previous menu"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                    ) : null}
                    {currentNodeId ? (
                        <button
                            onClick={goHome}
                            className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            aria-label="Back to contact list home"
                        >
                            <Home className="h-5 w-5" />
                        </button>
                    ) : null}
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {currentNode?.title ?? "D14 Contact List"}
                    </h1>
                </div>

                {breadcrumbNodes.length ? (
                    <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <button onClick={goHome} className="hover:text-foreground">
                            Home
                        </button>
                        {breadcrumbNodes.map((node) => (
                            <span key={node.id} className="flex items-center gap-1">
                                <ChevronRight className="h-3 w-3" />
                                <button
                                    onClick={() => openNode(node.id)}
                                    className="hover:text-foreground"
                                >
                                    {node.title}
                                </button>
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="search"
                    inputMode="search"
                    autoComplete="off"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search names, brigades, agencies, suburbs, phone…"
                    className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {searchQuery ? (
                    <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Clear search"
                    >
                        <X className="h-4 w-4" />
                    </button>
                ) : null}
            </div>

            {/* Body */}
            {!directory && !loadError ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                    <span>Loading contact list…</span>
                </div>
            ) : loadError ? (
                <Card className="border-destructive/40">
                    <CardHeader>
                        <CardTitle className="text-base">Directory unavailable</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">{loadError}</p>
                    </CardContent>
                </Card>
            ) : deferredSearchQuery ? (
                /* Search results */
                <Section title={`Results (${searchResults.length})`}>
                    {searchResults.length ? (
                        <div className="space-y-2">
                            {searchResults.map((result) => (
                                <NavRow
                                    key={result.node_id}
                                    title={result.title}
                                    subtitle={result.path.join(" / ")}
                                    onClick={() => openNode(result.node_id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No entries matched that search. Try a brigade name, person, agency, or
                            suburb.
                        </p>
                    )}
                </Section>
            ) : currentNode ? (
                /* Node detail */
                <div className="space-y-6">
                    <ContactMethodLines methods={currentNode.contact_methods} />

                    {childNodes.length ? (
                        <Section title="Sections">
                            <div className="space-y-2">
                                {childNodes.map((child) => {
                                    const bits = [
                                        child.children?.length
                                            ? formatCount(child.children.length, "section", "sections")
                                            : null,
                                        child.contacts?.length
                                            ? formatCount(child.contacts.length, "contact", "contacts")
                                            : null,
                                        child.cards?.length
                                            ? formatCount(child.cards.length, "card", "cards")
                                            : null,
                                        child.vehicles?.length
                                            ? formatCount(child.vehicles.length, "vehicle", "vehicles")
                                            : null,
                                    ].filter(Boolean) as string[];

                                    return (
                                        <NavRow
                                            key={child.id}
                                            title={child.title}
                                            subtitle={bits.join(" · ") || null}
                                            onClick={() => openNode(child.id)}
                                        />
                                    );
                                })}
                            </div>
                        </Section>
                    ) : null}

                    {currentNode.station_details ? (
                        <Section title={currentNode.kind === "group" ? "Group Details" : "Details"}>
                            <Card>
                                <CardContent className="space-y-3 p-4">
                                    {currentNode.station_details.display_lines?.length ? (
                                        <DetailLines lines={currentNode.station_details.display_lines} />
                                    ) : null}
                                    {currentNode.station_details.paging?.length ? (
                                        <div className="flex flex-wrap gap-2">
                                            {currentNode.station_details.paging.map((entry) => (
                                                <span
                                                    key={`${entry.code}-${entry.label}`}
                                                    className="rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground"
                                                >
                                                    <span className="font-semibold">{entry.code}</span>
                                                    <span className="mx-1.5 text-muted-foreground">·</span>
                                                    {entry.label}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                    <ContactMethodLines
                                        methods={currentNode.station_details.contact_methods}
                                    />
                                </CardContent>
                            </Card>
                        </Section>
                    ) : null}

                    {currentNode.cards?.length ? (
                        <Section title={currentNode.cards.length === 1 ? "Entry" : "Entries"}>
                            <div className="space-y-3">
                                {currentNode.cards.map((card) => (
                                    <ContactCardItem key={card.id} card={card} />
                                ))}
                            </div>
                        </Section>
                    ) : null}

                    {currentNode.contacts?.length ? (
                        <Section title="Contacts">
                            <div className="space-y-3">
                                {currentNode.contacts.map((contact) => (
                                    <ContactPersonItem key={contact.id} contact={contact} />
                                ))}
                            </div>
                        </Section>
                    ) : null}

                    {currentNode.vehicles?.length ? (
                        <Section title="Vehicles">
                            <div className="space-y-3">
                                {currentNode.vehicles.map((vehicle, index) => (
                                    <VehicleItem key={`${vehicle.name}-${index}`} vehicle={vehicle} />
                                ))}
                            </div>
                        </Section>
                    ) : null}

                    {!getNodeSummary(currentNode) ? (
                        <Card className="border-dashed">
                            <CardContent className="p-4">
                                <p className="text-sm text-muted-foreground">
                                    This part of the contact book has no details of its own. Use the
                                    sections above or search to keep exploring.
                                </p>
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            ) : (
                /* Root menu */
                <div className="space-y-2">
                    {rootMenuItems.map(({ entry }) => {
                        const bits = [
                            entry.child_count
                                ? formatCount(entry.child_count, "section", "sections")
                                : null,
                            formatPageRange(entry.page_range),
                        ].filter(Boolean) as string[];

                        return (
                            <NavRow
                                key={entry.id}
                                title={entry.title}
                                subtitle={bits.join(" · ") || null}
                                onClick={() => openNode(entry.id)}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

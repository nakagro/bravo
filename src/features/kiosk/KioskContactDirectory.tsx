import { startTransition, useDeferredValue, useEffect, useId, useState, type ReactNode } from 'react';
import {
    ArrowLeft,
    ChevronRight,
    Home,
    Search,
    X,
} from 'lucide-react';

interface KioskContactDirectoryProps {
    onBack: () => void;
}

interface ContactMethods {
    phones?: string[];
    emails?: string[];
    websites?: string[];
}

interface PagingEntry {
    code: string;
    label: string;
}

interface StationDetails {
    display_lines?: string[];
    melway_refs?: string[];
    paging?: PagingEntry[];
    contact_methods?: ContactMethods;
}

interface ContactCard {
    id: string;
    title?: string | null;
    display_lines?: string[];
    contact_methods?: ContactMethods;
}

interface ContactRecord {
    id: string;
    role?: string;
    name?: string;
    display_lines?: string[];
    phones?: string[];
    emails?: string[];
    address_lines?: string[];
    notes?: string[];
}

interface VehicleRecord {
    name: string;
    phone?: string | null;
    notes?: string[];
    raw_vehicle_names?: string;
    raw_vehicle_phones?: string;
    unmatched_phone_numbers?: string[];
    phone_mapping_confidence?: 'exact' | 'uncertain' | string;
}

interface ContactNode {
    id: string;
    title: string;
    kind: string;
    code?: string;
    source_pages?: number[];
    page_range?: number[];
    child_count?: number;
    parent_group?: string;
    contact_methods?: ContactMethods;
    cards?: ContactCard[];
    children?: ContactNode[];
    contacts?: ContactRecord[];
    vehicles?: VehicleRecord[];
    station_details?: StationDetails;
}

interface SearchEntry {
    node_id: string;
    title: string;
    kind: string;
    path: string[];
    phones?: string[];
    emails?: string[];
    websites?: string[];
    search_text: string;
}

interface TopLevelMenuEntry {
    id: string;
    title: string;
    child_count?: number;
    page_range?: number[];
}

interface ContactBookData {
    top_level_menu: TopLevelMenuEntry[];
    sections: ContactNode[];
    search_index: SearchEntry[];
}

interface ContactDirectoryIndex {
    rootMenuItems: Array<{ entry: TopLevelMenuEntry; node: ContactNode }>;
    searchEntries: SearchEntry[];
    nodeById: Map<string, ContactNode>;
    parentById: Map<string, string | null>;
}

const CONTACT_BOOK_URL = '/data/d14_contact_book.json';

let contactDirectoryPromise: Promise<ContactDirectoryIndex> | null = null;

function buildContactDirectoryIndex(contactBook: ContactBookData): ContactDirectoryIndex {
    const nodeById = new Map<string, ContactNode>();
    const parentById = new Map<string, string | null>();

    function indexNode(node: ContactNode, parentId: string | null) {
        nodeById.set(node.id, node);
        parentById.set(node.id, parentId);

        for (const child of node.children ?? []) {
            indexNode(child, node.id);
        }
    }

    for (const rootNode of contactBook.sections ?? []) {
        indexNode(rootNode, null);
    }

    const rootMenuItems = (contactBook.top_level_menu ?? [])
        .map((entry) => {
            const node = nodeById.get(entry.id);

            if (!node) {
                return null;
            }

            return { entry, node };
        })
        .filter((item): item is { entry: TopLevelMenuEntry; node: ContactNode } => item !== null);

    return {
        rootMenuItems,
        searchEntries: contactBook.search_index ?? [],
        nodeById,
        parentById,
    };
}

async function loadContactDirectory() {
    if (!contactDirectoryPromise) {
        contactDirectoryPromise = fetch(CONTACT_BOOK_URL, { cache: 'force-cache' })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Unable to load contact directory (${response.status})`);
                }

                const contactBook = (await response.json()) as ContactBookData;
                return buildContactDirectoryIndex(contactBook);
            })
            .catch((error) => {
                contactDirectoryPromise = null;
                throw error;
            });
    }

    return contactDirectoryPromise;
}

const TOP_LEVEL_PALETTES = [
    'bg-red-600 hover:bg-red-500 border-red-500',
    'bg-orange-600 hover:bg-orange-500 border-orange-500',
    'bg-amber-600 hover:bg-amber-500 border-amber-500',
    'bg-lime-600 hover:bg-lime-500 border-lime-500',
    'bg-emerald-600 hover:bg-emerald-500 border-emerald-500',
    'bg-cyan-600 hover:bg-cyan-500 border-cyan-500',
    'bg-sky-600 hover:bg-sky-500 border-sky-500',
    'bg-indigo-600 hover:bg-indigo-500 border-indigo-500',
    'bg-fuchsia-600 hover:bg-fuchsia-500 border-fuchsia-500',
];

function formatPageRange(pageRange?: number[]) {
    if (!pageRange?.length) {
        return null;
    }

    const [start, end] = pageRange;

    if (typeof start !== 'number') {
        return null;
    }

    if (typeof end !== 'number' || start === end) {
        return `Page ${start}`;
    }

    return `Pages ${start}-${end}`;
}

function formatCount(value: number, singular: string, plural: string) {
    return `${value} ${value === 1 ? singular : plural}`;
}

function getNodeTrail(
    nodeId: string,
    nodeById: Map<string, ContactNode>,
    parentById: Map<string, string | null>,
) {
    const trail: ContactNode[] = [];
    let currentId: string | null = nodeId;

    while (currentId) {
        const currentNode = nodeById.get(currentId);

        if (!currentNode) {
            break;
        }

        trail.unshift(currentNode);
        currentId = parentById.get(currentId) ?? null;
    }

    return trail;
}

function getNodeSummary(node: ContactNode) {
    const childCount = node.children?.length ?? 0;
    const cardCount = node.cards?.length ?? 0;
    const contactCount = node.contacts?.length ?? 0;
    const vehicleCount = node.vehicles?.length ?? 0;
    const linesCount = node.station_details?.display_lines?.length ?? 0;

    return [childCount, cardCount, contactCount, vehicleCount, linesCount].some((count) => count > 0);
}

function getSearchScore(entry: SearchEntry, query: string) {
    const title = entry.title.toLowerCase();
    const path = entry.path.join(' ').toLowerCase();
    const searchText = entry.search_text.toLowerCase();
    let score = 0;

    if (title === query) score += 500;
    if (title.startsWith(query)) score += 260;
    if (title.includes(query)) score += 180;
    if (path.includes(query)) score += 90;
    if (searchText.includes(query)) score += 40;

    return score - entry.path.length;
}

function getSearchResults(query: string, searchEntries: SearchEntry[], nodeById: Map<string, ContactNode>) {
    return searchEntries
        .map((entry) => ({ entry, score: getSearchScore(entry, query) }))
        .filter(({ entry, score }) => score > 0 && nodeById.has(entry.node_id))
        .sort((left, right) => right.score - left.score || left.entry.path.length - right.entry.path.length)
        .slice(0, 18)
        .map(({ entry }) => entry);
}

function InfoPanel({
    title,
    description,
    children,
}: {
    title: string;
    description?: string | null;
    children: ReactNode;
}) {
    return (
        <section className="rounded-[1.75rem] border-2 border-slate-800 bg-slate-900/90 p-4 md:p-5 shadow-xl">
            <div className="mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">{title}</h2>
                {description ? (
                    <p className="mt-1.5 max-w-4xl text-base md:text-lg text-slate-400 leading-relaxed">{description}</p>
                ) : null}
            </div>
            {children}
        </section>
    );
}

function DetailList({ lines }: { lines: string[] }) {
    return (
        <div className="space-y-2 text-base md:text-lg text-slate-200 leading-relaxed">
            {lines.map((line, index) => (
                <p key={`${line}-${index}`}>{line}</p>
            ))}
        </div>
    );
}

function KioskContactDirectory({ onBack }: KioskContactDirectoryProps) {
    const searchInputId = useId();
    const [directory, setDirectory] = useState<ContactDirectoryIndex | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        let cancelled = false;

        loadContactDirectory()
            .then((loadedDirectory) => {
                if (cancelled) {
                    return;
                }

                setDirectory(loadedDirectory);
                setLoadError(null);
            })
            .catch((error) => {
                if (cancelled) {
                    return;
                }

                setLoadError(error instanceof Error ? error.message : 'Unable to load contact directory.');
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());
    const currentNode = currentNodeId && directory ? directory.nodeById.get(currentNodeId) ?? null : null;
    const trail =
        currentNodeId && directory
            ? getNodeTrail(currentNodeId, directory.nodeById, directory.parentById)
            : [];
    const breadcrumbNodes = trail.slice(0, -1);
    const searchResults =
        deferredSearchQuery && directory
            ? getSearchResults(deferredSearchQuery, directory.searchEntries, directory.nodeById)
            : [];
    const rootMenuItems = directory?.rootMenuItems ?? [];

    const openNode = (nodeId: string) => {
        startTransition(() => {
            setCurrentNodeId(nodeId);
            setIsSearchOpen(false);
            setSearchQuery('');
        });
    };

    const handleBack = () => {
        if (isSearchOpen) {
            startTransition(() => {
                setIsSearchOpen(false);
                setSearchQuery('');
            });
            return;
        }

        if (!currentNodeId) {
            onBack();
            return;
        }

        const parentId = directory?.parentById.get(currentNodeId) ?? null;
        startTransition(() => setCurrentNodeId(parentId));
    };

    const goHome = () => {
        startTransition(() => {
            setCurrentNodeId(null);
            setIsSearchOpen(false);
            setSearchQuery('');
        });
    };

    const openSearch = () => {
        startTransition(() => setIsSearchOpen(true));
    };

    const closeSearch = () => {
        startTransition(() => {
            setIsSearchOpen(false);
            setSearchQuery('');
        });
    };

    const renderChildGrid = (node: ContactNode) => {
        const childNodes = node.children ?? [];

        if (!childNodes.length) {
            return null;
        }

        return (
            <InfoPanel
                title={node.kind === 'groups_and_brigades_collection' ? 'Groups' : 'Subsections'}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                    {childNodes.map((childNode) => {
                        const summaryBits = [
                            childNode.children?.length
                                ? formatCount(childNode.children.length, 'child', 'children')
                                : null,
                            childNode.contacts?.length
                                ? formatCount(childNode.contacts.length, 'contact', 'contacts')
                                : null,
                            childNode.cards?.length ? formatCount(childNode.cards.length, 'card', 'cards') : null,
                            childNode.vehicles?.length
                                ? formatCount(childNode.vehicles.length, 'vehicle', 'vehicles')
                                : null,
                        ].filter(Boolean);

                        return (
                            <button
                                key={childNode.id}
                                onClick={() => openNode(childNode.id)}
                                className="group flex min-h-36 flex-col justify-between rounded-[1.5rem] border-2 border-slate-700 bg-slate-950/70 p-4 text-left shadow-lg transition-all hover:border-sky-500 hover:bg-slate-900 active:scale-[0.98]"
                            >
                                <div className="flex items-start justify-end gap-4">
                                    <ChevronRight className="mt-1 h-6 w-6 text-slate-500 group-hover:text-white" />
                                </div>
                                <div className="mt-4">
                                    <h3 className="text-xl md:text-2xl font-bold text-white leading-tight tracking-tight">
                                        {childNode.title}
                                    </h3>
                                    {summaryBits.length ? (
                                        <p className="mt-2 text-base md:text-lg text-slate-400 leading-relaxed">
                                            {summaryBits.join(' · ')}
                                        </p>
                                    ) : null}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </InfoPanel>
        );
    };

    const renderCards = (node: ContactNode) => {
        if (!node.cards?.length) {
            return null;
        }

        return (
            <InfoPanel title={node.cards.length === 1 ? 'Entry' : 'Entries'}>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
                    {node.cards.map((card) => (
                        <article
                            key={card.id}
                            className="rounded-[1.25rem] border border-slate-800 bg-slate-950/70 p-4 md:p-5"
                            style={{ contentVisibility: 'auto', containIntrinsicSize: '320px' }}
                        >
                            {card.title ? (
                                <h3 className="mb-3 text-lg md:text-xl font-bold text-white tracking-tight">{card.title}</h3>
                            ) : null}
                            {card.display_lines?.length ? <DetailList lines={card.display_lines} /> : null}
                        </article>
                    ))}
                </div>
            </InfoPanel>
        );
    };

    const renderStationDetails = (node: ContactNode) => {
        const stationDetails = node.station_details;

        if (!stationDetails) {
            return null;
        }

        return (
            <InfoPanel
                title={node.kind === 'group' ? 'Group Details' : 'Station Details'}
                description="Location, paging, and contact references from the contact book."
            >
                <div className="space-y-5">
                    {stationDetails.display_lines?.length ? <DetailList lines={stationDetails.display_lines} /> : null}
                    {stationDetails.paging?.length ? (
                        <div className="flex flex-wrap gap-3">
                            {stationDetails.paging.map((entry) => (
                                <div
                                    key={`${entry.code}-${entry.label}`}
                                    className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm md:text-base text-slate-200"
                                >
                                    <span className="font-semibold text-white">{entry.code}</span>
                                    <span className="mx-2 text-slate-500">·</span>
                                    <span>{entry.label}</span>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            </InfoPanel>
        );
    };

    const renderContacts = (node: ContactNode) => {
        if (!node.contacts?.length) {
            return null;
        }

        return (
            <InfoPanel
                title="Contacts"
                description="Tap a phone number or email address to use it directly on devices that support calling or mail."
            >
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
                    {node.contacts.map((contact) => (
                        <article
                            key={contact.id}
                            className="rounded-[1.25rem] border border-slate-800 bg-slate-950/70 p-4 md:p-5"
                            style={{ contentVisibility: 'auto', containIntrinsicSize: '280px' }}
                        >
                            {contact.role ? (
                                <p className="mb-2 text-sm md:text-base font-semibold uppercase tracking-[0.16em] text-sky-300">
                                    {contact.role}
                                </p>
                            ) : null}
                            <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                                {contact.name || 'Unnamed Contact'}
                            </h3>
                            {contact.display_lines?.length ? (
                                <div className="mt-4">
                                    <DetailList lines={contact.display_lines} />
                                </div>
                            ) : null}
                            {contact.notes?.length ? (
                                <div className="mt-4 rounded-2xl border border-amber-600/40 bg-amber-900/20 px-4 py-3 text-base md:text-lg text-amber-100">
                                    {contact.notes.join(' ')}
                                </div>
                            ) : null}
                        </article>
                    ))}
                </div>
            </InfoPanel>
        );
    };

    const renderVehicles = (node: ContactNode) => {
        if (!node.vehicles?.length) {
            return null;
        }

        return (
            <InfoPanel
                title="Vehicles"
                description="Vehicle phone numbers are shown as extracted from the PDF. Some brigade pages contained uncertain phone alignment."
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
                        {node.vehicles.map((vehicle, index) => (
                            <article
                                key={`${vehicle.name}-${index}`}
                                className="rounded-[1.25rem] border border-slate-800 bg-slate-950/70 p-4 md:p-5"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                                            {vehicle.name}
                                        </h3>
                                        <p className="mt-1.5 text-base md:text-lg text-slate-400">
                                            {vehicle.phone ? `Phone: ${vehicle.phone}` : 'Phone not confirmed'}
                                        </p>
                                    </div>
                                </div>
                                {vehicle.phone ? (
                                    null
                                ) : null}
                                {vehicle.notes?.length ? (
                                    <p className="mt-4 text-base md:text-lg text-slate-300">{vehicle.notes.join(' ')}</p>
                                ) : null}
                                {vehicle.phone_mapping_confidence === 'uncertain' ? (
                                    <div className="mt-5 space-y-3 rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                                        {vehicle.raw_vehicle_names ? (
                                            <div>
                                                <p className="text-sm md:text-base font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                    Raw Vehicle Names
                                                </p>
                                                <p className="mt-2 whitespace-pre-line text-base md:text-lg text-slate-200">
                                                    {vehicle.raw_vehicle_names}
                                                </p>
                                            </div>
                                        ) : null}
                                        {vehicle.raw_vehicle_phones ? (
                                            <div>
                                                <p className="text-sm md:text-base font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                    Raw Phone Block
                                                </p>
                                                <p className="mt-2 whitespace-pre-line text-base md:text-lg text-slate-200">
                                                    {vehicle.raw_vehicle_phones}
                                                </p>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </article>
                        ))}
                    </div>
                </div>
            </InfoPanel>
        );
    };

    const renderNodeContent = (node: ContactNode) => {
        return (
            <div className="space-y-4">
                {renderChildGrid(node)}
                {renderCards(node)}
                {renderStationDetails(node)}
                {renderContacts(node)}
                {renderVehicles(node)}

                {!getNodeSummary(node) ? (
                    <InfoPanel
                        title="No Display Data"
                        description="This part of the contact book is indexed for navigation, but it does not have a display block of its own."
                    >
                        <p className="text-lg md:text-xl text-slate-300">
                            Use the available child tiles or the directory search above to keep exploring.
                        </p>
                    </InfoPanel>
                ) : null}
            </div>
        );
    };

    const renderSearchResults = () => (
        <div className="space-y-6">
            <InfoPanel
                title="Search Results"
                description={`Matches from ${directory?.searchEntries.length ?? 0} indexed entries.`}
            >
                {searchResults.length ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
                        {searchResults.map((result) => (
                            <button
                                key={result.node_id}
                                onClick={() => openNode(result.node_id)}
                                className="group rounded-[1.5rem] border-2 border-slate-800 bg-slate-950/70 p-4 text-left transition-all hover:border-sky-500 hover:bg-slate-900 active:scale-[0.98]"
                            >
                                <div className="flex items-start justify-end gap-4">
                                    <ChevronRight className="mt-1 h-6 w-6 text-slate-500 group-hover:text-white" />
                                </div>
                                <h2 className="mt-4 text-xl md:text-2xl font-bold text-white tracking-tight leading-tight">
                                    {result.title}
                                </h2>
                                <p className="mt-2 text-sm md:text-base text-slate-400 leading-relaxed">
                                    {result.path.join(' / ')}
                                </p>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-[1.5rem] border-2 border-slate-800 bg-slate-950/70 p-6 md:p-8">
                        <p className="text-lg md:text-2xl text-slate-200">
                            No directory entries matched that search. Try a brigade name, person name, agency, or
                            suburb.
                        </p>
                    </div>
                )}
            </InfoPanel>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-slate-950 text-slate-50 select-none touch-none">
            <header className="flex-none border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur md:px-6 md:py-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 md:gap-3">
                        <button
                            onClick={handleBack}
                            className="rounded-xl bg-slate-800 p-3 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white active:bg-slate-600"
                            aria-label={currentNodeId ? 'Back to previous menu' : 'Back to kiosk home'}
                        >
                            <ArrowLeft className="h-7 w-7 md:h-8 md:w-8" />
                        </button>
                        <button
                            onClick={goHome}
                            className="rounded-xl bg-slate-800 p-3 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white active:bg-slate-600 disabled:opacity-40"
                            aria-label="Return to contact list home"
                            disabled={!currentNodeId && !searchQuery}
                        >
                            <Home className="h-7 w-7 md:h-8 md:w-8" />
                        </button>
                    </div>

                    <div className="min-w-0 flex-1 px-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs md:text-sm text-slate-500">
                            <button onClick={goHome} className="hover:text-white">
                                D14 Contact List
                            </button>
                            {breadcrumbNodes.map((node) => (
                                <div key={node.id} className="flex items-center gap-1.5">
                                    <ChevronRight className="h-3.5 w-3.5" />
                                    <button
                                        onClick={() => openNode(node.id)}
                                        className="truncate text-left hover:text-white"
                                    >
                                        {node.title}
                                    </button>
                                </div>
                            ))}
                        </div>
                        <h1 className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight text-white">
                            {currentNode?.title ?? 'District 14 Contact List'}
                        </h1>
                    </div>
                    <button
                        onClick={openSearch}
                        className="rounded-xl bg-slate-800 p-3 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white active:bg-slate-600"
                        aria-label="Open search"
                        disabled={!directory}
                    >
                        <Search className="h-7 w-7 md:h-8 md:w-8" />
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-4 pb-4 pt-4 md:px-6 md:pt-5">
                {!directory && !loadError ? (
                    <InfoPanel
                        title="Loading contact directory"
                        description="Preparing the District 14 contact book."
                    >
                        <div className="flex items-center gap-4 text-base md:text-lg text-slate-300">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400" />
                            <p>The directory is being loaded for the kiosk.</p>
                        </div>
                    </InfoPanel>
                ) : loadError ? (
                    <InfoPanel
                        title="Directory unavailable"
                        description="The contact book could not be loaded from the server."
                    >
                        <p className="text-base md:text-lg text-slate-300">{loadError}</p>
                    </InfoPanel>
                ) : currentNode ? (
                    renderNodeContent(currentNode)
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
                            {rootMenuItems.map(({ entry }, index) => {
                                const summaryBits = [
                                    entry.child_count
                                        ? formatCount(entry.child_count, 'section', 'sections')
                                        : null,
                                    formatPageRange(entry.page_range),
                                ].filter(Boolean);

                                return (
                                    <button
                                        key={entry.id}
                                        onClick={() => openNode(entry.id)}
                                        className={`group flex min-h-[11.5rem] flex-col justify-between rounded-[1.75rem] border-2 p-4 md:p-5 text-left text-white shadow-xl transition-all active:scale-[0.98] ${TOP_LEVEL_PALETTES[index % TOP_LEVEL_PALETTES.length]}`}
                                    >
                                        <div className="flex items-start justify-end gap-4">
                                            <ChevronRight className="mt-1 h-7 w-7 text-white/75" />
                                        </div>
                                        <div className="mt-5">
                                            <h3 className="text-xl md:text-2xl font-bold leading-tight tracking-tight">
                                                {entry.title}
                                            </h3>
                                            {summaryBits.length ? (
                                                <p className="mt-2 text-sm md:text-base text-white/90 leading-relaxed">
                                                    {summaryBits.join(' · ')}
                                                </p>
                                            ) : null}
                                        </div>
                                    </button>
                                );
                            })}
                    </div>
                )}
            </main>

            {isSearchOpen ? (
                <div className="fixed inset-0 z-[120] bg-slate-950/94 backdrop-blur-sm">
                    <div className="flex h-full flex-col px-4 py-4 md:px-6">
                        <div className="flex items-center justify-between gap-3">
                            <label htmlFor={searchInputId} className="sr-only">
                                Search the contact directory
                            </label>
                            <div className="relative flex-1">
                                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 md:h-6 md:w-6" />
                                <input
                                    id={searchInputId}
                                    type="search"
                                    inputMode="search"
                                    autoComplete="off"
                                    autoFocus
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search names, brigades, groups, agencies, suburbs or phone numbers"
                                    className="w-full rounded-[1.5rem] border-2 border-slate-800 bg-slate-900 py-4 pl-12 pr-4 text-lg md:text-xl text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                                />
                            </div>
                            <button
                                onClick={closeSearch}
                                className="rounded-xl bg-slate-800 p-3 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white active:bg-slate-600"
                                aria-label="Close search"
                            >
                                <X className="h-7 w-7 md:h-8 md:w-8" />
                            </button>
                        </div>

                        <div className="mt-4 flex-1 overflow-y-auto pb-2">
                            {!directory && !loadError ? (
                                <InfoPanel
                                    title="Loading search"
                                    description="The contact book must load before search can be used."
                                >
                                    <p className="text-base md:text-lg text-slate-300">Please wait a moment.</p>
                                </InfoPanel>
                            ) : loadError ? (
                                <InfoPanel
                                    title="Search unavailable"
                                    description="The contact book could not be loaded from the server."
                                >
                                    <p className="text-base md:text-lg text-slate-300">{loadError}</p>
                                </InfoPanel>
                            ) : deferredSearchQuery ? (
                                renderSearchResults()
                            ) : (
                                <InfoPanel
                                    title="Search"
                                    description="Enter a person, brigade, municipality, agency, suburb, email, or phone number."
                                >
                                    <p className="text-base md:text-lg text-slate-300">
                                        Results will open directly into the matching section of the contact book.
                                    </p>
                                </InfoPanel>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default KioskContactDirectory;

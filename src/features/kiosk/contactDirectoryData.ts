// Shared data layer for the D14 Contact List.
// Used by both the full-screen kiosk view (KioskContactDirectory) and the
// mobile-friendly view (features/contacts/ContactDirectory). Keep all parsing,
// indexing, search and formatting logic here so both stay in sync.

export interface ContactMethods {
    phones?: string[];
    emails?: string[];
    websites?: string[];
}

export interface PagingEntry {
    code: string;
    label: string;
}

export interface StationDetails {
    display_lines?: string[];
    melway_refs?: string[];
    paging?: PagingEntry[];
    contact_methods?: ContactMethods;
}

export interface ContactCard {
    id: string;
    title?: string | null;
    display_lines?: string[];
    contact_methods?: ContactMethods;
}

export interface ContactRecord {
    id: string;
    role?: string;
    name?: string;
    display_lines?: string[];
    phones?: string[];
    emails?: string[];
    address_lines?: string[];
    notes?: string[];
}

export interface VehicleRecord {
    name: string;
    phone?: string | null;
    notes?: string[];
    raw_vehicle_names?: string;
    raw_vehicle_phones?: string;
    unmatched_phone_numbers?: string[];
    phone_mapping_confidence?: 'exact' | 'uncertain' | string;
}

export interface ContactNode {
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

export interface SearchEntry {
    node_id: string;
    title: string;
    kind: string;
    path: string[];
    phones?: string[];
    emails?: string[];
    websites?: string[];
    search_text: string;
}

export interface TopLevelMenuEntry {
    id: string;
    title: string;
    child_count?: number;
    page_range?: number[];
}

export interface ContactBookData {
    top_level_menu: TopLevelMenuEntry[];
    sections: ContactNode[];
    search_index: SearchEntry[];
}

export interface ContactDirectoryIndex {
    rootMenuItems: Array<{ entry: TopLevelMenuEntry; node: ContactNode }>;
    searchEntries: SearchEntry[];
    nodeById: Map<string, ContactNode>;
    parentById: Map<string, string | null>;
}

const CONTACT_BOOK_URL = '/data/d14_contact_book.json';

let contactDirectoryPromise: Promise<ContactDirectoryIndex> | null = null;

export function buildContactDirectoryIndex(contactBook: ContactBookData): ContactDirectoryIndex {
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

export async function loadContactDirectory() {
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

export function formatPageRange(pageRange?: number[]) {
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

export function formatCount(value: number, singular: string, plural: string) {
    return `${value} ${value === 1 ? singular : plural}`;
}

export function getNodeTrail(
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

export function getNodeSummary(node: ContactNode) {
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

export function getSearchResults(
    query: string,
    searchEntries: SearchEntry[],
    nodeById: Map<string, ContactNode>,
) {
    return searchEntries
        .map((entry) => ({ entry, score: getSearchScore(entry, query) }))
        .filter(({ entry, score }) => score > 0 && nodeById.has(entry.node_id))
        .sort((left, right) => right.score - left.score || left.entry.path.length - right.entry.path.length)
        .slice(0, 18)
        .map(({ entry }) => entry);
}

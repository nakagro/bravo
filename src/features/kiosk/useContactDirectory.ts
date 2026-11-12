import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { getServiceToken } from '@/features/serviceAccounts/ServiceAccountContext';
import { loadContactDirectory, type ContactDirectoryIndex } from './contactDirectoryData';

/**
 * Loads the contact book for either view: a signed-in member, or a kiosk tablet
 * on its PIN session (the stored service token is passed along when present).
 */
export function useContactDirectory(): {
    directory: ContactDirectoryIndex | null;
    loadError: string | null;
} {
    const file = useQuery(api.contactDirectory.getDirectoryFile, {
        serviceToken: getServiceToken() ?? undefined,
    });
    const [loaded, setLoaded] = useState<{ url: string; directory: ContactDirectoryIndex } | null>(null);
    const [fetchError, setFetchError] = useState<{ url: string; message: string } | null>(null);

    const url = file?.status === 'ready' ? file.url : null;

    useEffect(() => {
        if (!url) return;
        let cancelled = false;

        loadContactDirectory(url)
            .then((directory) => {
                if (!cancelled) setLoaded({ url, directory });
            })
            .catch((error) => {
                if (cancelled) return;
                setFetchError({
                    url,
                    message: error instanceof Error ? error.message : 'Unable to load contact directory.',
                });
            });

        return () => {
            cancelled = true;
        };
    }, [url]);

    if (file?.status === 'unauthorised') {
        return { directory: null, loadError: 'Sign in to view the contact directory.' };
    }
    if (file?.status === 'missing') {
        return {
            directory: null,
            loadError: 'No contact book has been uploaded yet. An admin can add one under Admin Settings.',
        };
    }
    if (url && fetchError?.url === url) {
        return { directory: null, loadError: fetchError.message };
    }
    return { directory: loaded && loaded.url === url ? loaded.directory : null, loadError: null };
}

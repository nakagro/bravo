import { formatDateTime } from '@/lib/dateFormat';
import packageData from '../../package.json';

export interface VersionInfo {
  year: string;
  month: string;
  day: string;
  version: string;
}

export const getVersion = (): VersionInfo => {
  const [year = '', month = '', day = ''] = packageData.version.split('.');
  return {
    year,
    month,
    day,
    version: packageData.version
  };
};

export const getVersionString = (): string => {
  return packageData.version;
};

/**
 * Which build this is, for anything that isn't a production build: branch,
 * short commit and when it was built. Prod (main) returns null and shows the
 * plain version. The date version only moves once a day, so this is how a
 * tester can tell a new UAT build has arrived.
 */
export const getBuildStamp = (): { short: string; full: string } | null => {
  const info = typeof __BUILD_INFO__ === 'undefined' ? null : __BUILD_INFO__;
  if (!info || !info.branch || info.branch === 'main') return null;
  const short = [info.branch, info.commit].filter(Boolean).join(' · ');
  const when = info.builtAt ? formatDateTime(info.builtAt) : '';
  return { short, full: [short, when && `built ${when}`].filter(Boolean).join(' · ') };
};

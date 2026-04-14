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

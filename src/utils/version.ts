import packageData from '../../package.json';

export interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
  version: string;
}

export const getVersion = (): VersionInfo => {
  const [major, minor, patch] = packageData.version.split('.').map(Number);
  return {
    major,
    minor,
    patch,
    version: packageData.version
  };
};

export const getVersionString = (): string => {
  return packageData.version;
};

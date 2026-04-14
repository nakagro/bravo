#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageFilePath = path.join(__dirname, '..', 'package.json');
const buildTimeZone = process.env.BUILD_VERSION_TIMEZONE || process.env.TZ || 'Australia/Melbourne';

const getDateVersion = (date = new Date(), timeZone = buildTimeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to derive build date for timezone "${timeZone}"`);
  }

  return `${year}.${month}.${day}`;
};

try {
  const packageData = JSON.parse(fs.readFileSync(packageFilePath, 'utf8'));
  const newVersion = getDateVersion();

  packageData.version = newVersion;
  fs.writeFileSync(packageFilePath, JSON.stringify(packageData, null, 2) + '\n');

  console.log(`Build version synced to: ${newVersion} (${buildTimeZone})`);
} catch (error) {
  console.error('Error syncing build version:', error);
  process.exit(1);
}

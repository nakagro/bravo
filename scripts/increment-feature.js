#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageFilePath = path.join(__dirname, '..', 'package.json');

try {
  // Read current package.json
  const packageData = JSON.parse(fs.readFileSync(packageFilePath, 'utf8'));
  
  // Parse current version
  const [major, minor, patch] = packageData.version.split('.').map(Number);
  
  // Increment minor version and reset patch
  const newMinor = minor + 1;
  const newVersion = `${major}.${newMinor}.0`;
  
  // Update version in package.json
  packageData.version = newVersion;
  
  // Write back to file
  fs.writeFileSync(packageFilePath, JSON.stringify(packageData, null, 2) + '\n');
  
  console.log(`Feature version incremented to: ${newVersion}`);
} catch (error) {
  console.error('Error incrementing feature version:', error);
  process.exit(1);
}

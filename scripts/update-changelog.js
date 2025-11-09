#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const changelogPath = path.join(__dirname, '..', 'changelog.json');
const packagePath = path.join(__dirname, '..', 'package.json');

// Get commit message file path from command line argument
const commitMsgFile = process.argv[2];

if (!commitMsgFile) {
  console.error('No commit message file provided');
  process.exit(1);
}

try {
  // Read the commit message
  const commitMessage = fs.readFileSync(commitMsgFile, 'utf8').trim();
  
  // Extract the first line (summary)
  const firstLine = commitMessage.split('\n')[0].trim();
  
  // Skip if it's a merge commit or empty
  if (!firstLine || firstLine.startsWith('Merge')) {
    console.log('Skipping changelog update for merge commit or empty message');
    process.exit(0);
  }
  
  // Read current version from package.json
  const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const version = packageData.version;
  
  // Read existing changelog
  let changelog = [];
  if (fs.existsSync(changelogPath)) {
    const changelogContent = fs.readFileSync(changelogPath, 'utf8');
    changelog = changelogContent.trim() ? JSON.parse(changelogContent) : [];
  }
  
  // Create new entry
  const newEntry = {
    version: version,
    message: firstLine,
    date: new Date().toISOString(),
    timestamp: Date.now()
  };
  
  // Add to beginning of changelog (newest first)
  changelog.unshift(newEntry);
  
  // Keep only last 100 entries to prevent file from growing too large
  if (changelog.length > 100) {
    changelog = changelog.slice(0, 100);
  }
  
  // Write back to file
  fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2) + '\n');
  
  console.log(`Changelog updated: v${version} - ${firstLine}`);
} catch (error) {
  console.error('Error updating changelog:', error);
  // Don't fail the commit if changelog update fails
  process.exit(0);
}

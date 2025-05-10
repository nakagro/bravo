import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the dist directory
const distPath = path.join(__dirname, 'dist');

// Copy serve.json to the dist directory if it exists
const serveJsonPath = path.join(__dirname, 'serve.json');
const distServeJsonPath = path.join(distPath, 'serve.json');

if (fs.existsSync(serveJsonPath)) {
  try {
    fs.copyFileSync(serveJsonPath, distServeJsonPath);
    console.log('Copied serve.json to dist directory');
  } catch (err) {
    console.error('Error copying serve.json:', err);
  }
}

// Spawn the serve command
const serveProcess = spawn('npx', ['serve', distPath, '-p', '3000'], {
  stdio: 'inherit',
  shell: true
});

serveProcess.on('error', (err) => {
  console.error('Failed to start serve process:', err);
});

console.log('Serving application from', distPath);

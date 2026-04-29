// build.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building main process...');

// Create dist-electron directory if it doesn't exist
if (!fs.existsSync('dist-electron')) {
  fs.mkdirSync('dist-electron');
}

// Find all TypeScript files
const files = [
  'src/main/main.ts',
  'src/preload.ts',
  'src/menu.ts',
  'src/util.ts'
];

// Check which files exist
const existingFiles = files.filter(file => fs.existsSync(file));
console.log('Found files to compile:', existingFiles);

if (existingFiles.length === 0) {
  console.error('No TypeScript files found!');
  console.log('Looking in:');
  console.log('  - src/main/main.ts');
  console.log('  - src/preload.ts');
  console.log('  - src/menu.ts');
  console.log('  - src/util.ts');
  process.exit(1);
}

// Compile TypeScript
try {
  const command = `npx tsc ${existingFiles.join(' ')} --outDir dist-electron --target ES2020 --module commonjs --esModuleInterop --skipLibCheck --allowJs`;
  console.log('Running:', command);
  execSync(command, { stdio: 'inherit' });
  console.log('✅ Main process compiled successfully!');
  
  // Check if main.js was created
  if (fs.existsSync('dist-electron/main.js')) {
    console.log('✅ main.js created at dist-electron/main.js');
  } else {
    console.log('⚠️ main.js not found at expected location');
    console.log('Files in dist-electron:', fs.readdirSync('dist-electron'));
  }
} catch (error) {
  console.error('❌ Compilation failed:', error.message);
  process.exit(1);
}
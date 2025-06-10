const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Clear dist folder
try {
const distPath = path.join(process.cwd(), 'dist');
  fs.rmSync(distPath, { recursive: true, force: true });
  console.log('Successfully cleared /dist folder');
} catch (err) {
  console.error('Error clearing /dist folder:', err);
  process.exit(1);
}

// Compile TypeScript
try {
  console.log('Compiling TypeScript...');
  execSync('tsc', { stdio: 'inherit' });
  console.log('Successfully compiled TypeScript');
} catch (err) {
  console.error('Error running TypeScript compiler:', err);
  process.exit(1);
}

// Extend compiled project with declarations but only from .ts files
// as .js declarations contain errors
try {
  console.log('Compiling TypeScript declarations...');
  execSync('tsc --project tsconfig.declaration.json', { stdio: 'inherit' });
  console.log('Successfully compiled TypeScript declarations');
} catch (err) {
  console.error('Error running TypeScript compiler:', err);
  process.exit(1);
}

// Copy index.d.ts to dist folder
try {
  const srcPath = path.join(process.cwd(), 'index.d.ts');
  const destPath = path.join(process.cwd(), 'dist', 'index.d.ts');
  fs.copyFileSync(srcPath, destPath);
  console.log('Successfully copied index.d.ts to /dist folder');
} catch (err) {
  console.error('Error copying index.d.ts to /dist folder:', err);
  process.exit(1);
}

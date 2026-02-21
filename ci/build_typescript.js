/* oxlint-disable no-console */
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

// Copy snowflake-sdk.d.ts to dist folder
try {
  const srcPath = path.join(process.cwd(), 'snowflake-sdk.d.ts');
  const destPath = path.join(process.cwd(), 'dist', 'snowflake-sdk.d.ts');
  fs.copyFileSync(srcPath, destPath);
  console.log('Successfully copied snowflake-sdk.d.ts to /dist folder');
} catch (err) {
  console.error('Error copying snowflake-sdk.d.ts to /dist folder:', err);
  process.exit(1);
}

// Copy minicore binaries to dist folder
try {
  const srcPath = path.join(process.cwd(), 'lib', 'minicore', 'binaries');
  const destPath = path.join(process.cwd(), 'dist', 'lib', 'minicore', 'binaries');
  fs.cpSync(srcPath, destPath, { recursive: true });
  console.log('Successfully copied minicore binaries to /dist folder');
} catch (err) {
  console.error('Error copying minicore binaries to /dist folder:', err);
  process.exit(1);
}

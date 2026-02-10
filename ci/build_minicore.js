/* oxlint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BINARIES_DIR = path.join('lib', 'minicore', 'binaries');

// Ensure we run from the project root
const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);
console.log(`Working directory set to project root: ${projectRoot}`);

// Clear lib/minicore/binaries folder
try {
  const distPath = path.join(projectRoot, BINARIES_DIR);
  fs.rmSync(distPath, { recursive: true, force: true });
  console.log(`Cleared ${BINARIES_DIR}`);
} catch (err) {
  console.error(`Failed to clear ${BINARIES_DIR}:`, err);
  process.exit(1);
}

// NOTE:
// In the future, we want to build on CI, but for now it's built on dev Mac
// using cross-build mode - https://napi.rs/docs/cross-build
const BUILD_TARGETS = [
  // macOS
  'aarch64-apple-darwin',
  'x86_64-apple-darwin',
  // Linux
  'aarch64-unknown-linux-gnu',
  'aarch64-unknown-linux-musl',
  'x86_64-unknown-linux-gnu',
  'x86_64-unknown-linux-musl',
  // Windows
  'aarch64-pc-windows-msvc',
  'x86_64-pc-windows-msvc',
  'i686-pc-windows-msvc',
];

for (const target of BUILD_TARGETS) {
  try {
    console.log(`Building Minicore binary for target: ${target}`);
    execSync(
      [
        'napi',
        'build',
        '--verbose',
        '--release',
        '--platform',
        '--no-js',
        '--strip',
        '--manifest-path',
        'lib/minicore/rust_minicore/Cargo.toml',
        '--output-dir',
        BINARIES_DIR,
        '--cross-compile',
        '--target',
        target,
      ].join(' '),
      { stdio: 'inherit', env: process.env },
    );
    console.log(`Successfully built target: ${target}`);
  } catch (err) {
    console.error(`Build failed for target ${target}:`, err);
    process.exit(1);
  }
}

console.log('All targets built successfully.');

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
  console.log(`Building Minicore binary for target: ${target}`);

  try {
    /*
     * cargo-zigbuild supports glibc version suffixes like "aarch64-unknown-linux-gnu.2.18",
     * but the napi CLI's artifact copy step fails because it expects the output directory
     * to match the full target string, while Cargo outputs to the clean triple directory
     * without the glibc suffix.
     *
     * So we use this hackish solution to build with cargo zigbuild directly and manually
     * copy/rename the .so to .node.
     */
    if (target.includes('linux-gnu')) {
      execSync(
        [
          'cargo',
          'zigbuild',
          '--release',
          '--manifest-path',
          'lib/minicore/rust_minicore/Cargo.toml',
          '--target',
          `${target}.2.18`, // Target GLIBC 2.18
        ].join(' '),
        { stdio: 'inherit' },
      );
      // Copy and rename artifact: libsf_mini_core.so → sf_mini_core_0.0.1.linux-arm64-gnu.node
      const [arch, , , abi] = target.split('-'); // aarch64, unknown, linux, gnu
      const platformArchABI = `linux-${arch === 'aarch64' ? 'arm64' : 'x64'}-${abi}`;
      const src = path.join(
        'lib',
        'minicore',
        'rust_minicore',
        'target',
        target,
        'release',
        `libsf_mini_core.so`,
      );
      const dest = path.join(BINARIES_DIR, `sf_mini_core_0.0.1.${platformArchABI}.node`);
      fs.copyFileSync(src, dest);
      console.log(`Copied ${src} → ${dest}`);
    } else {
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
    }

    console.log(`Successfully built target: ${target}`);
  } catch (err) {
    console.error(`Build failed for target ${target}:`, err);
    process.exit(1);
  }
}

console.log('All targets built successfully.');

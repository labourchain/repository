import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: true,
  clean: true,
  deps: {
    // Bootstrap owns the Cordis runtime used by this executable version.
    // Keep that runtime in the built artifact instead of resolving an arbitrary
    // compatible Cordis installation at process startup.
    alwaysBundle: ['@deepseek-ai/cordis'],
  },
})

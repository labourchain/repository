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
    // Cordis is the shared host runtime for the whole plugin composition.
    // Keep it external so Bootstrap and loaded plugins resolve the same module instance.
    neverBundle: ['@deepseek-ai/cordis'],
  },
})

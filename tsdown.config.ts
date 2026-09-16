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
    // Bootstrap PluginHash must commit to the Cordis runtime actually used by
    // the node. Keep the exact peer for type/plugin ecosystem compatibility,
    // but vendor its executable code into this artifact.
    alwaysBundle: ['@deepseek-ai/cordis'],
  },
})

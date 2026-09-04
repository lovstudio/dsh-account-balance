import { defineConfig } from 'tsdown'

/** Module-table specifiers the browser bundle resolves through the injected
 * require instead of inlining: the platform baseline plus the module rows this
 * package requests (type-only imports are erased and never reach this list).
 * Every other dependency (zod for the generated Remote codecs, …) must inline
 * — a require() the loader table cannot answer is a guaranteed runtime throw.
 * Runs after the Host pass so `@lovstudio/dsh-account-balance/remote` (the
 * generated Typert client artifact) can be inlined. */
const MODULE_TABLE_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-api-remotes/client',
  '@deepseek-ai/dsh-client-ui-layout/client',
]

const isModuleTableRow = (specifier: string): boolean => MODULE_TABLE_EXTERNALS.includes(specifier)

/** Build the browser card in the harness client-module closure format. */
export default defineConfig({
  entry: 'src/client/index.ts',
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  target: 'es2024',
  dts: false,
  clean: false,
  deps: {
    onlyBundle: false,
    neverBundle: isModuleTableRow,
    alwaysBundle: (specifier: string) => !isModuleTableRow(specifier),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "@lovstudio/dsh-account-balance", factory: (require) => {',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
})

export default {
  build: {
    lib: {
      entry: 'src/LovelyChart.js',
      name: 'LovelyChart',
      formats: ['iife', 'es'],
      // IIFE → LovelyChart.js (global var for <script src>); ESM → LovelyChart.mjs
      // (default export for `import`). Routed via package.json `exports`.
      fileName: (format) => (format === 'es' ? 'LovelyChart.mjs' : 'LovelyChart.js'),
      cssFileName: 'LovelyChart',
    },
    rollupOptions: {
      // Entry exposes only the named `create` export; keep the global/namespace
      // flat (`LovelyChart.create`) instead of emitting a `.default` wrapper.
      output: { exports: 'named' },
    },
    minify: false,
  },
};
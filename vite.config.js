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
    minify: false,
  },
};
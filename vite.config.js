export default {
  build: {
    // Emit native `#private` class members instead of WeakMap-based lowering
    // (default 'modules' target includes Safari 14, which lacks them).
    target: 'esnext',
    lib: {
      entry: 'src/LovelyChart.ts',
      name: 'LovelyChart',
      formats: ['es'],
      fileName: () => 'LovelyChart.js',
      cssFileName: 'LovelyChart',
    },
    minify: false,
  },
};

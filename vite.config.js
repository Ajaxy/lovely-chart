export default {
  build: {
    lib: {
      entry: 'src/LovelyChart.js',
      name: 'LovelyChart',
      formats: ['iife'],
      fileName: () => `LovelyChart.js`
    },
    minify: false,
  }
}
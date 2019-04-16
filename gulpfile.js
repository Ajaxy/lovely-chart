const path = require('path');
const gulp = require('gulp');
const merge = require('merge-stream');
const clone = require('gulp-clone');
const order = require('gulp-order');
const concat = require('gulp-concat');
const replace = require('gulp-replace');
const jsclosure = require('gulp-jsclosure');
const minifyJs = require('gulp-babel-minify');
const rename = require('gulp-rename');
const minifyCss = require('gulp-uglifycss');
const minifyJson = require('gulp-jsonminify');

gulp.task('prod', () => {
  const cloneSink = clone.sink();

  return merge(
    gulp
      .src('src/lovely-chart/*.js')
      .pipe(order([
        '*index*', '*constants*', '*LovelyChart*',
        '*StateManager*', '*TransitionManager*', '*Header*', '*Axes*', '*Minimap*', '*Tooltip*', '*Tools*', '*Zoomer*',
        '*canvas*', '*data*', '*preparePoints*', '*Projection*', '*drawDatasets*', '*skin*',
      ]))
      .pipe(concat('lovely-chart/LovelyChart.js'))
      .pipe(replace(/^import(.|\n)*?from.*?\n/gm, ''))
      .pipe(replace(/export /g, ''))
      .pipe(replace(/\n\s+\/\/ TODO.*/g, ''))
      .pipe(jsclosure())
      .pipe(cloneSink)
      .pipe(minifyJs())
      .pipe(rename('lovely-chart/LovelyChart.min.js'))
      .pipe(cloneSink.tap()),
    gulp
      .src('src/*.js'),
    // .pipe(minifyJs()),
    gulp
      .src('src/**/*.css'),
    // .pipe(minifyCss()),
    gulp
      .src('src/index.html')
      .pipe(replace('lovely-chart/styles/index.scss', 'lovely-chart/styles/lovely-chart.css'))
      .pipe(replace('lovely-chart/index.js', 'lovely-chart/LovelyChart.js')),
    gulp
      .src('src/**/*.svg'),
    gulp
      .src(['data/**/*.json'], { base: '.' })
      .pipe(minifyJson()),
  )
    .pipe(gulp.dest('docs/stage2secret'));
});

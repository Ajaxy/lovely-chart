const path = require('path');
const gulp = require('gulp');
const merge = require('merge-stream');
const order = require('gulp-order');
const concat = require('gulp-concat');
const replace = require('gulp-replace');
const jsclosure = require('gulp-jsclosure');
const minifyJs = require('gulp-babel-minify');
const minifyCss = require('gulp-uglifycss');
const minifyJson = require('gulp-jsonminify');

gulp.task('prod', () => {
  return merge(
    gulp
      .src('src/lovely-chart/*.js')
      .pipe(order([
        '*constants*', '*LovelyChart*',
        '*StateManager*', '*TransitionManager*', '*Header*', '*Axes*', '*Minimap*', '*Tooltip*', '*Tools*',
        '*analyzeData*', '*points*', '*createProjection*', '*drawDatasets*', '*skin*',
      ]))
      .pipe(concat('lovely-chart/LovelyChart.js'))
      .pipe(replace(/^import(.|\n)*?from.*?\n/gm, ''))
      .pipe(replace(/export /g, ''))
      .pipe(replace(/\n\s+\/\/ TODO.*/g, ''))
      .pipe(jsclosure()),
    // .pipe(minifyJs()),
    gulp
      .src('src/*.js'),
    // .pipe(minifyJs()),
    gulp
      .src('src/**/*.css'),
    // .pipe(minifyCss()),
    gulp
      .src('src/index.html')
      .pipe(replace('lovely-chart.scss', 'lovely-chart.css')),
    gulp
      .src('src/**/*.svg'),
    gulp
      .src(['data/**/*.json'], { base: '.' })
      .pipe(minifyJson()),
  )
    .pipe(gulp.dest('docs/stage2secret'));
});

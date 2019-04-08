const path = require('path');
const gulp = require('gulp');
const merge = require('merge-stream');
const concat = require('gulp-concat');
const replace = require('gulp-replace');
const jsclosure = require('gulp-jsclosure');
const minifyJs = require('gulp-terser');
const minifyCss = require('gulp-uglifycss');
const minifyJson = require('gulp-jsonminify');

gulp.task('prod', () => {
  return merge(
    gulp
      .src('src/lovely-chart/*.js')
      .pipe(concat('lovely-chart/LovelyChart.js'))
      .pipe(replace(/^import(.|\n)*?from.*?\n/gm, ''))
      .pipe(replace(/export /g, ''))
      .pipe(jsclosure())
      .pipe(minifyJs()),
    gulp
      .src('src/*.js')
      .pipe(minifyJs()),
    gulp
      .src(['src/**/*.css'])
      .pipe(minifyCss()),
    gulp
      .src(['src/**/*.!(js|css|json)']),
    gulp
      .src(['data/**/*.json'], { base: '.' })
      .pipe(minifyJson()),
  )
    .pipe(gulp.dest('docs/'));
});

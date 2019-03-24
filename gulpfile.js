const path = require('path');
const gulp = require('gulp');
const merge = require('merge-stream');
const concat = require('gulp-concat');
const replace = require('gulp-replace');
const jsclosure = require('gulp-jsclosure');
const uglify = require('gulp-terser');

gulp.task('prod', () => {
  return merge(
    (
      gulp
        .src('src/**/*.js')
        .pipe(concat('lovely-chart/LovelyChart.js'))
        .pipe(replace(/^import(.|\n)*?from.*?\n/gm, ''))
        .pipe(replace(/export /g, ''))
        .pipe(jsclosure())
        .pipe(uglify())
    ), (
      gulp
        .src(['src/**/*', '!src/**/*.js'])
    ),
  )
    .pipe(gulp.dest('docs/'));
});

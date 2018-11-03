var gulp       = require('gulp');
var browserify = require('browserify');
var source     = require('vinyl-source-stream');
var buffer     = require('vinyl-buffer');
var uglify     = require('gulp-uglify');

gulp.task('build-snowflake-browser', function()
{
  return browserify('./lib/browser.js').bundle()
      .pipe(source('snowflake.js'))
      .pipe(buffer())
      .pipe(uglify())
      .pipe(gulp.dest('./dist'));
});
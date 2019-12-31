var { series, watch, parallel, src, pipe, dest } = require('gulp');
var del = require('del');
var browserSync = require('browser-sync');
var postcss = require('gulp-postcss');
var sass = require('gulp-sass');
var prefix = require('autoprefixer');
var header = require('gulp-header');
var rename = require('gulp-rename');
var minify = require('cssnano');
var package = require('./package.json');
var flatmap = require('gulp-flatmap');
var concat = require('gulp-concat');
var lazypipe = require('lazypipe');
var optimizejs = require('gulp-optimize-js');
var uglify = require('gulp-terser');
var nunjucks = require('gulp-nunjucks');
var data = require('gulp-data');
var fs = require('fs');
var htmlmin = require('gulp-htmlmin');

var paths = {
	input: 'src/',
	output: 'dist/',
	scripts: {
		input: 'src/js/*',
		polyfills: '.polyfill.js',
		output: 'dist/js/'
	},
	styles: {
		input: 'src/sass/main.scss',
		output: 'dist/css/'
	},
	svgs: {
		input: 'src/svg/*.svg',
		output: 'dist/svg/'
	},
	template: {
		input: ['src/template/**/*.njk', '!src/template/base.njk'],
		output: 'dist/'
	},
	reload: 'dist/',
	config: 'src/config.json'
};

var banner = {
	main:
		'/*!' +
		' <%= package.name %> v<%= package.version %>' +
		' | (c) ' + new Date().getFullYear() + ' <%= package.author.name %>' +
		' | <%= package.license %> License' +
		' */\n'
};

var cleanDist = function (done) {
	del.sync([paths.output]);
	return done();
}

// Watch for changes to the src directory
var startServer = function (done) {

	// Initialize BrowserSync
	browserSync.init({
		server: {
			baseDir: paths.reload
		}
	});

	// Signal completion
	done();

};

// Copy static files into output folder
var renderTemplates = function (done) {

	// Render nunjucks template
	return src(paths.template.input)
		.pipe(data(function (file) {
			return JSON.parse(fs.readFileSync(paths.config))
		}))
		.pipe(nunjucks.compile())
		.pipe(htmlmin({ collapseWhitespace: true }))
		.pipe(rename({extname: '.html'}))
		.pipe(dest(paths.template.output));

};

// Process, lint, and minify Sass files
var buildStyles = function (done) {

	// Run tasks on all Sass files
	return src(paths.styles.input)
		.pipe(sass({
			outputStyle: 'expanded',
			sourceComments: true
		}))
		.pipe(postcss([
			prefix({
				cascade: true,
				remove: true
			})
		]))
		.pipe(header(banner.main, {package: package}))
		.pipe(dest(paths.styles.output))
		.pipe(rename({suffix: '.min'}))
		.pipe(postcss([
			minify({
				discardComments: {
					removeAll: true
				}
			})
		]))
		.pipe(dest(paths.styles.output));

};

// Reload the browser when files change
var reloadBrowser = function (done) {
	browserSync.reload();
	done();
};

// Watch for changes
var watchSource = function (done) {
	watch(paths.input, series(exports.default, reloadBrowser));
	done();
};

// Repeated JavaScript tasks
var jsTasks = lazypipe()
	.pipe(header, banner.main, {package: package})
	.pipe(rename, {suffix: '.min'})
	.pipe(uglify)
	.pipe(optimizejs)
	.pipe(dest, paths.scripts.output);

// Lint, minify, and concatenate scripts
var buildScripts = function (done) {

	// Run tasks on script files
	return src(paths.scripts.input)
		.pipe(flatmap(function (stream, file) {

			// If the file is a directory
			if (file.isDirectory()) {

				// Grab all files and concatenate them
				src(file.path + '/*.js')
					.pipe(concat(file.relative + '.js'))
					.pipe(jsTasks());

				return stream;

			}

			// Otherwise, process the file
			return stream.pipe(jsTasks());

		}));

};

exports.default = series(
	cleanDist,
	parallel(
		buildScripts,
		buildStyles,
		renderTemplates
	)
)

exports.watch = series(
	exports.default,
	startServer,
	watchSource
)
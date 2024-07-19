/**
 * Webpack configuration for pydata-sphinx-theme.
 *
 * This script does a few primary things:
 *
 * - Generates a `webpack-macros.html` file that defines macros used
 *   to insert CSS / JS at various places in the main `layout.html` template.
 * - Compiles our translation files into .mo files so they can be bundled with the theme
 * - Compiles our SCSS and JS and places them in the _static/ folder
 * - Downloads and links FontAwesome and some JS libraries (Bootstrap, etc)
 */

const { resolve } = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const dedent = require("dedent");
const { Compilation } = require("webpack");

/*******************************************************************************
 * Compile our translation files
 */
const { exec } = require("child_process");
const localePath = resolve(__dirname, "src/pydata_sphinx_theme/locale");
exec(`pybabel compile -d ${localePath} -D sphinx`);

/*******************************************************************************
 * Paths for various assets (sources and destinations)
 */

const scriptPath = resolve(__dirname, "src/pydata_sphinx_theme/assets/scripts");
const staticPath = resolve(__dirname, "src/pydata_sphinx_theme/theme/pydata_sphinx_theme/static");
const vendorPath = resolve(staticPath, "vendor");

/*******************************************************************************
 * functions to load the assets in the html head
 * the css, and js (preload/scripts) are digested for cache busting
 * the fonts are loaded from vendors
 */

function stylesheet(css) { return `<link href="{{ pathto('_static/${css}', 1) }}?digest=${this.hash}" rel="stylesheet" />`; }
function preload(js) { return `<link rel="preload" as="script" href="{{ pathto('_static/${js}', 1) }}?digest=${this.hash}" />`; }
function script(js) { return `<script src="{{ pathto('_static/${js}', 1) }}?digest=${this.hash}"></script>`; }

/*******************************************************************************
 * the assets to load in the macro
 */
const theme_stylesheets = [
  "styles/theme.css", // basic sphinx css
  "styles/bootstrap.css", // all bootstrap 5 css with variable adjustments
  "styles/pydata-sphinx-theme.css", // all the css created for this specific theme
];
const theme_scripts = [
  "scripts/bootstrap.js",
  "scripts/pydata-sphinx-theme.js",
];

/*******************************************************************************
 * Cache-busting Jinja2 macros (`webpack-macros.html`) used in `layout.html`
 *
 * @param  {Compilation} the compilation instance to extract the hash
 * @return {String} the macro to inject in layout.html
 */
function macroTemplate({ compilation }) {

  return dedent(`\
    <!--
      AUTO-GENERATED from webpack.config.js, do **NOT** edit by hand.
      These are re-used in layout.html
    -->

    {% macro head_pre_assets() %}
      <!-- Loaded before other Sphinx assets -->
      ${theme_stylesheets.map(stylesheet.bind(compilation)).join("\n")}
    {% endmacro %}

    {% macro head_js_preload() %}
      <!-- Pre-loaded scripts that we'll load fully later -->
      ${theme_scripts.map(preload.bind(compilation)).join("\n")}
    {% endmacro %}

    {% macro body_post() %}
      <!-- Scripts loaded after <body> so the DOM is not blocked -->
      ${theme_scripts.map(script.bind(compilation)).join("\n")}
    {% endmacro %}
  `);
}

/*******************************************************************************
 * Bundle the modules to use them in the theme outputs
 */

module.exports = {
  mode: "production",
  devtool: "source-map",
  entry: {
    "pydata-sphinx-theme": resolve(scriptPath, "pydata-sphinx-theme.js"),
    "bootstrap": resolve(scriptPath, "bootstrap.js"),
  },
  // src/pydata_sphinx_theme/theme/pydata_sphinx_theme/static
  output: { filename: "scripts/[name].js", path: staticPath },
  // output: { filename: "scripts/[name].js", path: __dirname + '/dist', },
  optimization: {
    minimizer: [
      new CssMinimizerPlugin(),
      // minify JS
      new TerserPlugin({
        terserOptions: { output: { ascii_only: true } }
      })
    ]
  },
  module: {
    rules: [
      {
        // needed to properly load the fonts
        test: /\.(woff(2)?|ttf|eot|otf)(\?v=\d+\.\d+\.\d+)?$/,
        // test: /\.(ttf|eot|svg|woff(2)?)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: "./vendor/fontawesome/fonts",
              publicPath: "./vendor/fontawesome/fonts",
            },
          }
        ]
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          MiniCssExtractPlugin.loader,
          // need url true to load the fonts
          { loader: "css-loader", options: { sourceMap: true, url: true } },
          {
            loader: "sass-loader",
            options: {
              sourceMap: true,
              sassOptions: {
                outputStyle: 'expanded',
              },
            },

          },
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: resolve(staticPath, "webpack-macros.html"),
      inject: false,
      minify: false,
      css: true,
      templateContent: macroTemplate,
    }),
    new MiniCssExtractPlugin({ filename: "styles/[name].css" })
  ],
  experiments: {
    topLevelAwait: true,
  },
};

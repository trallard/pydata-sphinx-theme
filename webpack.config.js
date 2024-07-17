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
const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin"); // minimise JS
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

const vendorVersions = { fontAwesome: require("@fortawesome/fontawesome-free/package.json").version };
const paths = {
  scriptPath: resolve(__dirname, "src/pydata_sphinx_theme/assets/scripts"),
  staticPath: resolve(__dirname, "src/pydata_sphinx_theme/theme/pydata_sphinx_theme/static"),
  vendorPath: resolve(staticPath, "vendor"),
  fontAwesomePath: resolve(vendorPath, "fontawesome", vendorVersions.fontAwesome)
};

/*******************************************************************************
 * functions to load the assets in the html head
 * the css, and js (preload/scripts) are digested for cache busting
 * the fonts are loaded from vendors
 */

const assetLoaders = {
  stylesheet: (css, hash) => `<link href="{{ pathto('_static/${css}', 1) }}?digest=${hash}" rel="stylesheet" />`,
  preload: (js, hash) => `<link rel="preload" as="script" href="{{ pathto('_static/${js}', 1) }}?digest=${hash}" />`,
  script: (js, hash) => `<script src="{{ pathto('_static/${js}', 1) }}?digest=${hash}"></script>`,
  font: (woff2) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="{{ pathto('_static/${woff2}', 1) }}" />`
};

/*******************************************************************************
 * Define assets to load in the macro
 */

const assets = {
  theme: {
    stylesheets: ["styles/theme.css", "styles/bootstrap.css", "styles/pydata-sphinx-theme.css"],
    scripts: ["scripts/bootstrap.js", "scripts/pydata-sphinx-theme.js"]
  },
  fontAwesome: {
    stylesheets: [`vendor/fontawesome/${vendorVersions.fontAwesome}/css/all.min.css`],
    scripts: [`vendor/fontawesome/${vendorVersions.fontAwesome}/js/all.min.js`],
    fonts: [
      `vendor/fontawesome/${vendorVersions.fontAwesome}/webfonts/fa-solid-900.woff2`,
      `vendor/fontawesome/${vendorVersions.fontAwesome}/webfonts/fa-brands-400.woff2`,
      `vendor/fontawesome/${vendorVersions.fontAwesome}/webfonts/fa-regular-400.woff2`
    ]
  }
};


/*******************************************************************************
 * Cache-busting Jinja2 macros (`webpack-macros.html`) used in `layout.html`
 *
 * @param  {Compilation} the compilation instance to extract the hash
 * @return {String} the macro to inject in layout.html
 */
function macroTemplate({ compilation }) {
  const { hash } = compilation;
  return dedent(`
    <!-- AUTO-GENERATED from webpack.config.js, do **NOT** edit by hand. -->
    {% macro head_pre_icons() %}
      ${assets.fontAwesome.stylesheets.map(css => assetLoaders.stylesheet(css, hash)).join("\n")}
      ${assets.fontAwesome.fonts.map(assetLoaders.font).join("\n")}
    {% endmacro %}

    {% macro head_pre_assets() %}
      ${assets.theme.stylesheets.map(css => assetLoaders.stylesheet(css, hash)).join("\n")}
    {% endmacro %}

    {% macro head_js_preload() %}
      ${assets.theme.scripts.map(js => assetLoaders.preload(js, hash)).join("\n")}
      ${assets.fontAwesome.scripts.map(js => assetLoaders.script(js, hash)).join("\n")}
    {% endmacro %}

    {% macro body_post() %}
      ${assets.theme.scripts.map(js => assetLoaders.script(js, hash)).join("\n")}
    {% endmacro %}
  `);
}

/*******************************************************************************
 * Bundle the modules to use them in the theme outputs
 */

const plugins = [
  new HtmlWebpackPlugin({
    filename: resolve(paths.static, "webpack-macros.html"),
    inject: false,
    minify: false,
    templateContent: macroTemplate
  }),
  new CopyPlugin({
    patterns: [
      { from: "LICENSE.txt", to: paths.fontAwesome, context: "./node_modules/@fortawesome/fontawesome-free" },
      { from: "css/all.min.css", to: resolve(paths.fontAwesome, "css"), context: "./node_modules/@fortawesome/fontawesome-free" },
      { from: "js/all.min.js", to: resolve(paths.fontAwesome, "js"), context: "./node_modules/@fortawesome/fontawesome-free" },
      { from: "webfonts", to: resolve(paths.fontAwesome, "webfonts"), context: "./node_modules/@fortawesome/fontawesome-free" }
    ]
  }),
  new MiniCssExtractPlugin({ filename: "styles/[name].css" })
];


module.exports = {
  mode: "production",
  devtool: "source-map",
  entry: {
    "pydata-sphinx-theme": resolve(paths.script, "pydata-sphinx-theme.js"),
    "bootstrap": resolve(paths.script, "bootstrap.js")
  },
  output: { filename: "scripts/[name].js", path: paths.static },
  optimization: {
    minimizer: [
      new CssMinimizerPlugin(),
      new TerserPlugin({ parallel: true })
    ]
  },
  module: {
    rules: [{
      test: /\.scss$/,
      use: [
        MiniCssExtractPlugin.loader,
        { loader: "css-loader", options: { url: false } },
        "sass-loader"
      ]
    }]
  },
  plugins,
  experiments: { topLevelAwait: true }
};

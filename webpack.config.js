import webpack from 'webpack';
import { VueLoaderPlugin } from 'vue-loader';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import { resolve } from 'path';

export default {
  entry: {
    popup: './src/popup/index.js',
    main: './src/content-scripts/main.js',
    isolated: './src/content-scripts/isolated.js',
  },
  output: {
    path: resolve(import.meta.dirname, 'dist'),
    filename: '[name].js',
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.css$/,
        use: [
          'vue-style-loader',
          'css-loader',
        ],
      },
      {
        test: /\.scss$/,
        use: [
          'vue-style-loader',
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              additionalData: '@use "/src/vue/scss/_variables" as *;',
            },
          },
        ],
      },
      {
        test: /\.(png|jpe?g|gif)$/i,
        use: [
          {
            loader: 'file-loader',
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    }),
    new VueLoaderPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        { from: './public' },
      ],
    }),
    new CleanWebpackPlugin(),
  ],
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      terserOptions: {
        format: {
          comments: false,
        },
      },
      extractComments: false,
    })],
  },
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
  infrastructureLogging: { level: 'error' },
  stats: 'minimal',
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
};

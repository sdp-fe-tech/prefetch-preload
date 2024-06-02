const path = require('path');
const { VueLoaderPlugin } = require('vue-loader');

const config = {
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    library: 'sdp-vue-prefetch',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  resolve: {
    extensions: ['.ts', '.js', '.vue']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: 'ts-loader'
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  },
  externals: [require('webpack-node-externals')()]
};

if (process.env.NODE_ENV === 'test') {
  config.module.rules.push({
    test: /\.vue$/,
    loader: 'vue-loader'
  });
  config.plugins = [
    new VueLoaderPlugin()
  ];
}

module.exports = config;

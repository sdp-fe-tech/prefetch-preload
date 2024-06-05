const path = require('path');
const { VueLoaderPlugin } = require('vue-loader');
const { execSync } = require('child_process');
const pkg = require('./package.json')
const config = {
  entry: './src/index.ts',
  mode: "production",
  output: {
    path: path.resolve(__dirname, 'build/umd'),
    filename: `sdp-vue-prefetch.umd.js`,
    library: 'sdp-vue-prefetch',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  resolve: {
    extensions: ['.ts', '.js', '.vue']
  },
  target: 'node', 
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                declaration: false // 不在 webpack 编译时生成声明文件
              }
            }
          }
        ],
        exclude: /node_modules/
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

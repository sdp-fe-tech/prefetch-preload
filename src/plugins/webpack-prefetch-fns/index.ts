import * as fs from 'fs';
import { Compiler } from 'webpack';
import { replaceContentHashInFilename } from '../../utils';
const safeRequire = require('safe-require')

interface FunctionData {
  name: string;
  fn: string;
}

interface PluginOptions {
  outputPath: string;
  outputFile?: string;
}

export class PrefetchAsyncFnPlugin {
  options: PluginOptions;

  constructor(options: PluginOptions) {
    this.options = options;
  }

  apply(compiler: Compiler): void {
    const { outputPath } = this.options;
    let hashedFilename: string;

    compiler.hooks.compilation.tap(
      'PrefetchAsyncFnPlugin',
      (compilation) => {
        const HtmlWebpackPlugin = safeRequire('html-webpack-plugin')
        const publicPath = compilation.outputOptions.publicPath;

        HtmlWebpackPlugin.getHooks(compilation).beforeAssetTagGeneration.tapAsync(
          'PrefetchAsyncFnPlugin',
          (data: { assets: { js: any[]; }; }, cb: (arg0: null, arg1: any) => void) => {
            const fileName = publicPath + hashedFilename
            data.assets.js.unshift(fileName)
            cb(null, data);
          },
        );

        compilation.hooks.processAssets.tapAsync(
          {
            name: 'RouteMappingPlugin',
            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
          },
          (assets, callback) => {
            if (fs.existsSync(outputPath) && fs.readFileSync(outputPath, 'utf-8')) {
              const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as { [key: string]: FunctionData[] };
              let source = 'window._prefetchAsyncFns = {\n';

              for (const [key, value] of Object.entries(data)) {
                source += `  '${key}': [\n`;
                value.forEach(({ name, fn }) => {
                  source += `    {\n      name: '${name}',\n      fn: ${fn},\n    },\n`;
                });
                source += '  ],\n';
              }

              source += '};\n';

              const outputFile = this.options.outputFile || 'prefetchAsyncFn.js';
              hashedFilename = replaceContentHashInFilename(outputFile, source);
              // 将生成的代码注入到资源中
              compilation.emitAsset(hashedFilename, {
                source: () => source,
                size: () => source.length,
              } as any);
            }
            callback();
          }
        )
      }
    );
  }
}


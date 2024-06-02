import * as fs from 'fs';
import { Compiler, Compilation } from 'webpack';
import { RawSource } from 'webpack-sources';

interface FunctionData {
  name: string;
  fn: string;
}

interface PluginOptions {
  outputPath: string;
}

class SdpPrefetchAsyncFnPlugin {
  options: PluginOptions;

  constructor(options: PluginOptions) {
    this.options = options;
  }

  apply(compiler: Compiler): void {
    const { outputPath } = this.options;

    compiler.hooks.emit.tapAsync(
      'SdpPrefetchAsyncFnPlugin',
      (compilation: Compilation, callback: () => void) => {
        if (fs.existsSync(outputPath) && fs.readFileSync(outputPath, 'utf-8')) {
          const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as { [key: string]: FunctionData[] };
          let source = 'window.__sdpPrefetchAsyncFns = {\n';

          for (const [key, value] of Object.entries(data)) {
            source += `  '${key}': [\n`;
            value.forEach(({ name, fn }) => {
              source += `    {\n      name: '${name}',\n      fn: ${fn},\n    },\n`;
            });
            source += '  ],\n';
          }

          source += '};\n';

          // 使用 RawSource 生成资源对象
          compilation.assets['sdpPrefetchAsyncFn.js'] = new RawSource(source) as any;
        }
        callback();
      }
    );
  }
}

export default SdpPrefetchAsyncFnPlugin;

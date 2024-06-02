const fs = require('fs');

class SdpPrefetchAsyncFnPlugin {
  constructor(options) {
    this.options = options;
  }
  apply(compiler) {
    const { outputPath } = this.options;

    compiler.hooks.emit.tapAsync(
      'SdpPrefetchAsyncFnPlugin',
      (compilation, callback) => {
        if (fs.existsSync(outputPath) && fs.readFileSync(outputPath, 'utf-8')) {
          const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
          let source = 'window.__sdpPrefetchAsyncFns = {\n';

          for (const [key, value] of Object.entries(data)) {
            source += `  '${key}': [\n`;
            value.forEach(({ name, fn }) => {
              source += `    {\n      name: '${name}',\n      fn: ${fn},\n    },\n`;
            });
            source += '  ],\n';
          }

          source += '};\n';

          compilation.assets['sdpPrefetchAsyncFn.js'] = {
            source: () => source,
            size: () => source.length,
          };
        }
        callback();
      },
    );
  }
}

module.exports = SdpPrefetchAsyncFnPlugin;

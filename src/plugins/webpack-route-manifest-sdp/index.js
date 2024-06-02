const { RawSource } = require('webpack-sources');

const NAME = 'webpack-route-manifest';

function toAsset(str) {
  if (/\.js$/i.test(str)) return 'script';
  if (/\.(svg|jpe?g|png|webp)$/i.test(str)) return 'image';
  if (/\.(woff2?|otf|ttf|eot)$/i.test(str)) return 'font';
  if (/\.css$/i.test(str)) return 'style';
  return false;
}

function toLink(assets, _pattern, _filemap) {
  let value = '';
  assets.forEach((obj) => {
    if (value) value += ', ';
    value += `<${obj.href}>; rel=preload; as=${obj.type}`;
    if (/^(font|script)$/.test(obj.type)) value += '; crossorigin=anonymous';
  });
  return [{ key: 'Link', value }];
}

function toFunction(val) {
  if (typeof val === 'function') return val;
  if (typeof val === 'object') return (key) => val[key];
}

class RouteManifest {
  constructor(opts = {}) {
    const { routes, assets, headers, minify } = opts;
    const { filename = 'manifest.js', sort = false, inline = false } = opts;

    if (!routes) {
      throw new Error('A "routes" mapping is required');
    }

    const toRoute = toFunction(routes);
    const toHeaders = toFunction(headers) || (headers === true && toLink);
    const toType = toFunction(assets) || toAsset;

    this.run = (bundle) => {
      const Pages = new Map();
      const Manifest = {};
      const Files = {};

      const { publicPath, chunks, modules } = bundle.getStats().toJson();

      // 映射页面到文件
      chunks.forEach((chunk) => {
        const { id, files, origins, entry } = chunk;
        const origin = origins[0].request;
        const route = origin && !entry ? toRoute(origin) : '*';
        if (route) {
          Pages.set(id, {
            assets: new Set(files),
            pattern: route,
          });
        }
      });

      // 获取每个路由的额外文件
      modules.forEach((mod) => {
        mod.assets.forEach((asset) => {
          mod.chunks.forEach((id) => {
            const tmp = Pages.get(id);
            if (tmp) {
              tmp.assets.add(asset);
              Pages.set(id, tmp);
            }
          });
        });
      });

      // 构建 `Files`
      Pages.forEach((obj) => {
        let tmp = (Files[obj.pattern] = Files[obj.pattern] || []);

        obj.assets.forEach((str) => {
          let type = toType(str);
          let href = publicPath + str;
          if (type) tmp.push({ type, href });
        });
      });

      function write(data) {
        const asset = Files['*'].find((x) => x.type === 'script');
        const script =
          asset && asset.href && asset.href.replace(publicPath, '');

        if (inline && script && bundle.assets[script]) {
          let nxt = `window.__sdp_base_manifest=${JSON.stringify(data)};`;
          nxt += bundle.assets[script].source();
          bundle.assets[script] = {
            size: () => nxt.length,
            source: () => nxt,
          };
        }

        const str = JSON.stringify(data, null, minify ? 0 : 2);
        bundle.assets[filename] = {
          size: () => str.length,
          source: () => str,
        };

        // 创建一个单独的JS块用于manifest
        const manifestScript = `window.__sdp_base_manifest=${JSON.stringify(data)};`;
        bundle.assets[filename] = new RawSource(manifestScript);
      }

      const routes = Object.keys(Files);

      if (!toHeaders) {
        return write(Files);
      }

      routes.forEach((pattern) => {
        const files = Files[pattern];
        const headers = toHeaders(files, pattern, Files) || [];
        Manifest[pattern] = { files, headers };
      });

      return write(Manifest);
    };
  }

  apply(compiler) {
    if (compiler.hooks !== void 0) {
      compiler.hooks.emit.tap(NAME, this.run);
    } else {
      compiler.plugin('emit', this.run);
    }
  }
}

module.exports = RouteManifest;

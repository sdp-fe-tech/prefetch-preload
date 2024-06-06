import { RawSource } from 'webpack-sources';
import { Compiler, Compilation } from 'webpack';

const NAME = 'webpack-route-manifest';

function toAsset(str: string): string | false {
  if (/\.js$/i.test(str)) return 'script';
  if (/\.(svg|jpe?g|png|webp)$/i.test(str)) return 'image';
  if (/\.(woff2?|otf|ttf|eot)$/i.test(str)) return 'font';
  if (/\.css$/i.test(str)) return 'style';
  return false;
}

interface Asset {
  type: string;
  href: string;
}

function toLink(assets: Asset[], _pattern: string, _filemap: Record<string, Asset[]>): Array<{ key: string; value: string }> {
  let value = '';
  assets.forEach((obj) => {
    if (value) value += ', ';
    value += `<${obj.href}>; rel=preload; as=${obj.type}`;
    if (/^(font|script)$/.test(obj.type)) value += '; crossorigin=anonymous';
  });
  return [{ key: 'Link', value }];
}

function toFunction<T>(val: Record<string, T> | ((key: string) => T) | undefined | boolean | Function): any {
  if (typeof val === 'function') return val as (key: string) => T;
  if (typeof val === 'object') return (key: string) => (val as Record<string, T>)[key];
}

export interface RouteManifestOptions {
  routes: Record<string, string> | ((key: string) => string);
  assets?: Record<string, string> | ((key: string) => string);
  headers?: boolean | ((assets: Asset[], pattern: string, filemap: Record<string, Asset[]>) => Array<{ key: string; value: string }>);
  minify?: boolean;
  filename?: string;
  sort?: boolean;
  inline?: boolean;
}

export class RouteManifestPlugin {
  run: (bundle: Compilation) => void;

  constructor(opts: RouteManifestOptions) {
    const { routes, assets, headers, minify, filename = 'manifest.js', inline = false } = opts;

    if (!routes) {
      throw new Error('A "routes" mapping is required');
    }

    const toRoute = toFunction(routes);
    const toHeaders = headers === true ? toLink : toFunction(headers);
    const toType = toFunction(assets) || toAsset;

    this.run = (bundle: Compilation) => {
      const Pages = new Map<number | string, { assets: Set<string>; pattern: string }>();
      const Manifest: Record<number | string, { files: Asset[]; headers: Array<{ key: string; value: string }> }> = {};
      const Files: Record<string, Asset[]> = {};

      const { publicPath, chunks, modules } = bundle.getStats().toJson();

      chunks?.forEach((chunk) => {
        const { id, files, origins, entry } = chunk;
        const origin = origins?.[0]?.request;
        const route = origin && !entry ? toRoute(origin) : '*';
        if (route && id) {
          Pages.set(id, {
            assets: new Set(files),
            pattern: route,
          });
        }
      });

      modules?.forEach((mod) => {
        mod?.assets?.forEach((asset) => {
          mod?.chunks?.forEach((id) => {
            const tmp = Pages.get(id);
            if (tmp) {
              tmp.assets.add(String(asset));
              Pages.set(id, tmp);
            }
          });
        });
      });

      Pages.forEach((obj) => {
        let tmp = (Files[obj.pattern] = Files[obj.pattern] || []);
        obj.assets.forEach((str) => {
          let type = toType(str);
          let href = publicPath + str;
          if (type) tmp.push({ type, href });
        });
      });

      const write = (data: any) => {
        const asset = Files['*'].find((x) => x.type === 'script');
        const script = publicPath ? asset?.href?.replace(publicPath, '') : undefined

        if (inline && script && bundle.assets[script]) {
          let nxt = `window.__sdp_base_manifest=${JSON.stringify(data)};`;
          nxt += bundle.assets[script].source();
          bundle.assets[script] = new RawSource(nxt) as any;
        }

        const str = JSON.stringify(data, null, minify ? 0 : 2);
        bundle.assets[filename] = new RawSource(str) as any;

        // 创建一个单独的JS块用于manifest
        const manifestScript = `window.__sdp_base_manifest=${JSON.stringify(data)};`;
        bundle.assets[filename] = new RawSource(manifestScript) as any;
      };

      const routes = Object.keys(Files);

      if (!toHeaders) {
        return write(Files);
      }

      routes.forEach((pattern) => {
        const files = Files[pattern];
        const headers = toHeaders(files as any, pattern, Files) || [];
        Manifest[pattern] = { files, headers };
      });

      return write(Manifest);
    };
  }

  apply(compiler: Compiler) {
    compiler.hooks.emit.tapAsync(NAME, (compilation, callback) => {
      this.run(compilation);
      callback();
    });
  }
}


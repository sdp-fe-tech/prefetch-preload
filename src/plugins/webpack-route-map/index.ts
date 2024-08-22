import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { Compiler } from 'webpack';
import { createHash, BinaryToTextEncoding } from 'crypto'
const safeRequire = require('safe-require')

function createContentHash(
  content: string,
  hashFunction: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'md5',
  digestType: BinaryToTextEncoding = 'hex'
): string {
  const hash = createHash(hashFunction);
  hash.update(content);
  return hash.digest(digestType);
}
function replaceContentHashInFilename(
  filename: string,
  content: string,
  hashFunction: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'md5',
  digestType: BinaryToTextEncoding = 'hex'
): string {
  return filename.replace(/\[contenthash(?::(\d+))?\]/g, (_, length) => {
    const fullHash = createContentHash(content, hashFunction, digestType);
    return length ? fullHash.substring(0, parseInt(length)) : fullHash;
  });
}

interface RouteMappingPluginOptions {
  routerFilePath: string;
  outputFile?: string;
}

interface RouteMapping {
  componentName: string;
  importPath: string;
}

/**
 * @description:
 */
export class RouteMappingPlugin {
  options: RouteMappingPluginOptions;

  constructor(options: RouteMappingPluginOptions) {
    this.options = options;
  }

  apply(compiler: Compiler) {
    let hashedFilename;

    compiler.hooks.compilation.tap('MyPlugin', (compilation) => {
      const HtmlWebpackPlugin = safeRequire('html-webpack-plugin')

      HtmlWebpackPlugin.getHooks(compilation).beforeAssetTagGeneration.tapAsync(
        'MyPlugin',
        (data: { plugin: { options: { chunks: string[]; }; }; }, cb: (arg0: null, arg1: any) => void) => {
          // 确保将 route-mapping 加入到 chunks 中
          if (!data.plugin.options.chunks.includes('route-mapping')) {
            data.plugin.options.chunks.push('route-mapping');
          }
          cb(null, data);
        },
      );

      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tapAsync(
        'MyPlugin',
        (data: { headTags: { tagName: string; voidTag: boolean; attributes: { src: string; }; }[]; }, cb: (arg0: null, arg1: any) => void) => {
          // 动态添加 route-mapping.js 到 script 标签中
          data.headTags.push({
            tagName: 'script',
            voidTag: false,
            attributes: { src: `xxxx.js` },
          });
          console.log('data.headTags', data.headTags);
          cb(null, data);
        },
      );
    });


    compiler.hooks.emit.tapAsync(
      'RouteMappingPlugin',
      (compilation, callback) => {
        const routerFilePath = path.resolve(this.options.routerFilePath);
        const outputFile = this.options.outputFile || 'route-mapping.js';

        fs.readFile(routerFilePath, 'utf-8', (err, data) => {
          if (err) {
            return callback(err);
          }

          const ast = parser.parse(data, {
            sourceType: 'module',
            plugins: ['dynamicImport'],
          });

          const routeMappings: RouteMapping[] = [];
          const dynamicImports = new Map();

          traverse(ast, {
            ImportDeclaration({ node }) {
              const importPath = node.source.value;
              const componentName = node.specifiers[0].local.name;
              routeMappings.push({ componentName, importPath });
            },
            CallExpression(path) {
              if (
                path.node.callee.type === 'Import' &&
                path.node.arguments[0].type === 'StringLiteral'
              ) {
                const importPath = path.node.arguments[0].value;
                const parentPath = path.findParent(
                  (p) =>
                    p.isObjectProperty() && (p.node.key as any).name === 'component',
                );
                if (parentPath) {
                  dynamicImports.set(parentPath.node, importPath);
                }
              }
            },
          });

          const routes: { path?: string; component?: string }[] = [];

          traverse(ast, {
            Declaration(path) {
              // 类型为VariableDeclaration且参数名为prefetchRoutes
              if (path.node.type === 'VariableDeclaration' && (path.node.declarations[0].id as any).name === 'prefetchRoutes') {
                if (path.node.declarations[0].init && path.node.declarations[0].init.type === 'ArrayExpression') {
                  const prefetchRoutes = path.node.declarations[0].init.elements;
                  (prefetchRoutes).forEach((routeNode: any) => {
                    if (routeNode.type === 'ObjectExpression') {
                      const route: { path?: string; component?: string } = {};
                      routeNode.properties.forEach((prop: any) => {
                        if (prop.key.name === 'path') {
                          route.path = prop.value.value;
                        }
                        if (prop.key.name === 'component') {
                          if (
                            prop.value.type === 'ArrowFunctionExpression' &&
                            dynamicImports.has(prop)
                          ) {
                            route.component = dynamicImports.get(prop);
                          } else if (prop.value.type === 'Identifier') {
                            const componentName = prop.value.name;
                            const mapping = routeMappings.find(
                              (m) => m.componentName === componentName,
                            );
                            if (mapping) {
                              route.component = mapping.importPath;
                            }
                          }
                        }
                      });
                      if (route.path && route.component) {
                        routes.push(route);
                      }
                    }
                  });
                }
              }
            }
          });
          const code = `window.__sdp_base_route_maps = ${JSON.stringify(routes)}`;
          hashedFilename = replaceContentHashInFilename(outputFile, code)
          compilation.assets[hashedFilename] = {
            source: () => code,
            size: () => code.length,
          } as any;

          callback();
        });
      },
    );
  }
}


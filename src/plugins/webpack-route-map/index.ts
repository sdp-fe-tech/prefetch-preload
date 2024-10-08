import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { Compiler } from 'webpack';
import { replaceContentHashInFilename } from '../../utils';
const safeRequire = require('safe-require')


interface RouteMappingPluginOptions {
  routerFilePath: string;
  outputFile?: string;
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
    let hashedFilename: string;

    compiler.hooks.compilation.tap('RouteMappingPlugin', (compilation) => {

      const HtmlWebpackPlugin = safeRequire('html-webpack-plugin')
      const publicPath = compilation.outputOptions.publicPath;

      HtmlWebpackPlugin.getHooks(compilation).beforeAssetTagGeneration.tapAsync(
        'RouteMappingPlugin',
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
          // 检查 是否有routerFilePath, 没有的话使用项目src目录下的prefetch.js
          let routerFilePath;
          try {
            routerFilePath = this.options.routerFilePath?
              path.resolve(this.options.routerFilePath):
              path.resolve('src/prefetch.js');
          } catch (error) {
            console.error('RouteMappingPlugin Error:', error);
            return callback();
          }

          const outputFile = this.options.outputFile || 'route-mapping.js';

          fs.readFile(routerFilePath, 'utf-8', (err, data) => {
            if (err) {
              return callback(err);
            }

            const ast = parser.parse(data, {
              sourceType: 'module',
              plugins: ['dynamicImport'],
            });

            const routeMappings: { componentName: string; importPath: string; }[] = [];
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

            const routes: {}[] = [];

            traverse(ast, {
              Declaration(path) {
                if (
                  path.node.type === 'VariableDeclaration' &&
                  (path.node.declarations[0].id as any).name === 'prefetchRoutes'
                ) {
                  if (
                    path.node.declarations[0].init &&
                    path.node.declarations[0].init.type === 'ArrayExpression'
                  ) {
                    const prefetchRoutes =
                      path.node.declarations[0].init.elements;
                    prefetchRoutes.forEach((routeNode: any) => {
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
              },
            });

            const code = `window._base_route_maps = ${JSON.stringify(
              routes
            )}`;

            hashedFilename = replaceContentHashInFilename(outputFile, code);

            // 将生成的代码注入到资源中
            compilation.emitAsset(hashedFilename, {
              source: () => code,
              size: () => code.length,
            } as any);

            callback();
          });
        }
      );
    });
  }
}


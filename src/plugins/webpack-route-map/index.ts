import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { Compiler } from 'webpack';

interface RouteMappingPluginOptions {
  routerFilePath: string;
  outputFile?: string;
}

interface RouteMapping {
  componentName: string;
  importPath: string;
}

class RouteMappingPlugin {
  options: RouteMappingPluginOptions;

  constructor(options: RouteMappingPluginOptions) {
    this.options = options;
  }

  apply(compiler: Compiler) {
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
            NewExpression(path) {
              if (
                (path.node.callee as any).name === 'Router' &&
                path.node.arguments.length > 0 &&
                path.node.arguments[0].type === 'ObjectExpression'
              ) {
                const routesProperty = path.node.arguments[0].properties.find(
                  (prop: any) => prop.key.name === 'routes',
                );

                if (
                  routesProperty &&
                  (routesProperty as any).value.type === 'ArrayExpression'
                ) {
                  (routesProperty as any).value.elements.forEach((routeNode: any) => {
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
          const code = `window.__sdp_base_route_maps = ${JSON.stringify(routes)}`;
          compilation.assets[outputFile] = {
            source: () => code,
            size: () => code.length,
          } as any;

          callback();
        });
      },
    );
  }
}

export default RouteMappingPlugin;
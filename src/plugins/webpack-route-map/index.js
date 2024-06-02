const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const { RawSource } = require('webpack-sources');

class RouteMappingPlugin {
  constructor(options = {}) {
    this.options = options;
  }

  apply(compiler) {
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

          const routeMappings = [];
          const dynamicImports = new Map();

          traverse(ast, {
            ImportDeclaration({ node }) {
              // 处理 import 语句，获取组件路径
              const importPath = node.source.value;
              const componentName = node.specifiers[0].local.name;
              routeMappings.push({ componentName, importPath });
            },
            CallExpression(path) {
              // 处理动态 import 语句
              if (
                path.node.callee.type === 'Import' &&
                path.node.arguments[0].type === 'StringLiteral'
              ) {
                const importPath = path.node.arguments[0].value;
                const parentPath = path.findParent(
                  (p) =>
                    p.isObjectProperty() && p.node.key.name === 'component',
                );
                if (parentPath) {
                  dynamicImports.set(parentPath.node, importPath);
                }
              }
            },
          });

          const routes = [];

          traverse(ast, {
            NewExpression(path) {
              // 确保只处理 new Router() 实例
              if (
                path.node.callee.name === 'Router' &&
                path.node.arguments.length > 0 &&
                path.node.arguments[0].type === 'ObjectExpression'
              ) {
                const routesProperty = path.node.arguments[0].properties.find(
                  (prop) => prop.key.name === 'routes',
                );

                if (
                  routesProperty &&
                  routesProperty.value.type === 'ArrayExpression'
                ) {
                  routesProperty.value.elements.forEach((routeNode) => {
                    if (routeNode.type === 'ObjectExpression') {
                      const route = {};
                      routeNode.properties.forEach((prop) => {
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

          const outputPath = path.resolve(
            compilation.options.output.path,
            outputFile,
          );
          const code = `window.__sdp_base_route_maps = ${JSON.stringify(routes)}`;
          compilation.assets[outputFile] = {
            source: () => code,
            size: () => outputData.length,
          };
          // compilation.assets[outputFile] = new RawSource(manifestScript);
          callback();
        });
      },
    );
  }
}

module.exports = RouteMappingPlugin;

import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import generate from '@babel/generator';
import * as fs from 'fs';
import * as path from 'path';
import { LoaderContext } from 'webpack';

const processedFiles = new Set<string>();

interface FunctionData {
  name: string;
  fn: string;
}

function extractScriptContent(source: string): string | null {
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const matches = scriptRegex.exec(source);
  return matches ? matches[1] : null;
}

function extractGetClientDataFunctions(scriptContent: string): FunctionData[] {
  const ast = parser.parse(scriptContent, {
    sourceType: 'module',
    plugins: ['jsx'],
  });

  const functions: FunctionData[] = [];

  traverse(ast, {
    ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
      const declaration = path.node.declaration;
      if (t.isVariableDeclaration(declaration)) {
        declaration.declarations.forEach((declarator) => {
          if (
            t.isCallExpression(declarator.init) &&
            t.isIdentifier(declarator.init.callee, { name: 'getClientData' })
          ) {
            const asyncFunction = declarator.init.arguments[0]; // 提取传递给 getClientData 的异步函数
            if (
              t.isArrowFunctionExpression(asyncFunction) ||
              t.isFunctionExpression(asyncFunction)
            ) {
              functions.push({
                name: (declarator.id as t.Identifier).name,
                fn: generate(asyncFunction).code,
              });
            }
          }
        });
      }
    },
  });

  return functions;
}

function addToFunctions(
  existingFunctions: { [key: string]: FunctionData[] },
  newFunctions: FunctionData[],
  resourcePath: string,
  dirPath: string
): { [key: string]: FunctionData[] } {

  //踩坑: path.relative(dirPath, resourcePath) 会生成相对路径，而这个路径在 Windows 系统上会使用反斜杠\\,导致后续匹配不对
  const relativePath = path.relative(dirPath, resourcePath).replace(/\\/g, '/'); // 将反斜杠替换为正斜杠
  if (!existingFunctions[relativePath]) {
    existingFunctions[relativePath] = [];
  }

  newFunctions.forEach(({ name, fn }) => {
    const existingIndex = existingFunctions[relativePath].findIndex(
      (func) => func.name === name
    );
    if (existingIndex !== -1) {
      // 如果存在相同名称的函数，更新其内容
      existingFunctions[relativePath][existingIndex].fn = fn;
    } else {
      // 如果不存在，添加新的函数
      existingFunctions[relativePath].push({ name, fn });
    }
  });

  return existingFunctions;
}

export default function (
  this: LoaderContext<any>,
  source: string
): string | Buffer {
  if (
    !source.includes('getClientData') ||
    processedFiles.has(this.resourcePath)
  ) {
    return source;
  }

  const options = this.getOptions();
  const { outputPath, dirPath } = options;

  const scriptContent = extractScriptContent(source);
  if (!scriptContent) {
    return source;
  }

  const newFunctions = extractGetClientDataFunctions(scriptContent);

  if (newFunctions.length > 0) {
    const existingFunctions = fs.existsSync(outputPath)
      ? JSON.parse(fs.readFileSync(outputPath, 'utf-8') || '{}')
      : {};
    const updatedFunctions = addToFunctions(
      existingFunctions,
      newFunctions,
      this.resourcePath,
      dirPath
    );

    fs.writeFileSync(
      outputPath,
      JSON.stringify(updatedFunctions, null, 2),
      'utf-8'
    );
  }
  // 将处理过的文件路径添加到 Set 中
  processedFiles.add(this.resourcePath);
  return source;
}


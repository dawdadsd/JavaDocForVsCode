/**
 * SymbolResolver.ts - 符号解析器
 *
 * 【什么是 DocumentSymbol？】
 * VS Code 的语言服务（如 Java 扩展）会分析代码，提取出"符号"：
 * - 类（Class）
 * - 方法（Method）
 * - 字段（Field）
 * - 等等...
 *
 * 每个符号包含：名称、类型、在文件中的位置（行号范围）
 *
 * 【为什么用 Symbol API 而不是自己解析？】
 * 1. 准确：语言服务用完整的解析器，能处理各种复杂语法
 * 2. 可靠：泛型、注解、内部类等都能正确识别
 * 3. 省力：不需要自己写 Java 语法解析器
 */

import * as vscode from 'vscode';
import type { DocumentSymbol, Uri } from 'vscode';

/**
 * 获取文档中的所有符号
 *
 * 【vscode.commands.executeCommand 解释】
 * VS Code 有很多内置命令，可以通过 ID 调用
 * 'vscode.executeDocumentSymbolProvider' 会调用当前语言的符号提供器
 * 对于 Java 文件，会由 Java 语言扩展处理
 *
 * @param uri - 文件的 URI
 * @returns 符号列表，如果解析失败返回空数组
 */
export async function resolveSymbols(uri: Uri): Promise<DocumentSymbol[]> {
  try {
    // 调用 VS Code 内置命令获取符号
    // 泛型参数 <DocumentSymbol[]> 指定返回类型
    const symbols = await vscode.commands.executeCommand<DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      uri
    );

    // 可能返回 undefined（例如没有安装 Java 语言扩展）
    // 使用空值合并运算符 ?? 提供默认值
    return symbols ?? [];
  } catch (error) {
    // 发生错误时记录日志并返回空数组
    // 【为什么不抛出异常？】
    // 解析失败不应该导致整个扩展崩溃
    // 返回空数组，让上层代码优雅降级
    console.error('[SymbolResolver] Failed to resolve symbols:', error);
    return [];
  }
}

/**
 * 检查符号是否是类/接口（可以包含方法的容器）
 */
export function isClassLikeSymbol(symbol: DocumentSymbol): boolean {
  return (
    symbol.kind === vscode.SymbolKind.Class ||
    symbol.kind === vscode.SymbolKind.Interface
  );
}

/**
 * 检查符号是否是方法/构造函数
 */
export function isMethodSymbol(symbol: DocumentSymbol): boolean {
  return (
    symbol.kind === vscode.SymbolKind.Method ||
    symbol.kind === vscode.SymbolKind.Constructor
  );
}

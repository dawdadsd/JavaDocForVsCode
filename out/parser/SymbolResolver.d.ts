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
import type { DocumentSymbol, Uri } from "vscode";
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
export declare function resolveSymbols(uri: Uri): Promise<DocumentSymbol[]>;
/**
 * 检查符号是否是类/接口（可以包含方法的容器）
 */
export declare function isClassLikeSymbol(symbol: DocumentSymbol): boolean;
/**
 * 检查符号是否是方法/构造函数
 */
export declare function isMethodSymbol(symbol: DocumentSymbol): boolean;
/**
 * check symbol is field or constant
 * @param symbol document symbol
 * @returns boolean
 */
export declare function isFieldSymbol(symbol: DocumentSymbol): boolean;

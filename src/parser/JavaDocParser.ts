/**
 * JavaDocParser.ts - Javadoc 主解析器
 *
 * 【职责】
 * 1. 调用 SymbolResolver 获取代码结构
 * 2. 从源代码中提取 Javadoc 注释
 * 3. 调用 TagParser 解析标签
 * 4. 组装成 ClassDoc 数据结构
 * 5. 获取 Git 作者信息
 *
 * 【解析流程】
 * TextDocument → Symbol树 → 扁平化符号列表 → 按类别分别解析 → ClassDoc
 *
 * 【符号分类】
 * Symbol 树中的符号被分为四类：
 *   Container（类/接口/枚举）→ 递归展开子符号
 *   Method / Constructor     → parseMethod（通过 kind 字段区分）
 *   Field / Constant         → parseField
 *   EnumMember               → parseEnumConstant（独立解析路径）
 */

import type { TextDocument, DocumentSymbol } from "vscode";
import {
  resolveSymbols,
  isClassLikeSymbol,
  isMethodSymbol,
  isFieldSymbol,
  isEnumMemberSymbol,
  isConstructorSymbol,
} from "./SymbolResolver.js";
import { parseTagTable } from "./TagParser.js";
import { gitService } from "../services/GitService.js";
import type {
  ClassDoc,
  MethodDoc,
  MethodKind,
  FieldDoc,
  EnumConstantDoc,
  TagTable,
  AccessModifier,
  GitAuthorInfo,
} from "../types.js";
import { MethodId, LineNumber, FilePath, EMPTY_TAG_TABLE } from "../types.js";

// ========== 内部类型 ==========

/**
 * 扁平化后的符号信息
 *
 * 【为什么需要扁平化？】
 * Symbol 树是嵌套的（类 → 内部类 → 方法），
 * 我们需要把所有成员提取到同一层级，附带 belongsTo 记录归属关系
 */
interface FlattenedSymbol {
  readonly symbol: DocumentSymbol;
  readonly belongsTo: string; // 所属类名，如 "OuterClass.InnerClass"
}

// ========== 解析器 ==========

/**
 * Javadoc 解析器
 */
export class JavaDocParser {
  /** 匹配 Java 注解 @Override, @Transactional 等 */
  private readonly annotationPattern = /^\s*@\w+/;

  /**
   * 解析 Java 文档
   *
   * @param document - VS Code 的文档对象
   * @returns 解析后的类文档结构
   */
  public async parse(document: TextDocument): Promise<ClassDoc> {
    const symbols = await resolveSymbols(document.uri);
    const text = document.getText();
    const filePath = document.uri.fsPath;

    // ---- 类级别信息 ----
    const classSymbol = symbols.find(isClassLikeSymbol);
    const className = classSymbol?.name ?? this.extractClassNameFromText(text);
    const packageName = this.extractPackageName(text);
    const classLine = classSymbol?.range.start.line ?? 0;

    const classComment = classSymbol
      ? this.extractComment(text, classSymbol.range.start.line)
      : "";
    const { author: javadocAuthor, since: javadocSince } =
      this.parseClassJavadoc(classComment);

    // ---- 扁平化 Symbol 树 ----
    const flattenedSymbols = this.flattenSymbols(symbols, "");

    // ---- 按类别分别解析 ----
    // 传入 classComment 用于排除 Lombok 等工具生成的符号误关联类注释的情况
    // 例如 @Slf4j 生成的 log 字段，Language Server 将其位置报告在类声明附近，
    // extractComment 向上搜索会错误地找到类 Javadoc
    const methods = flattenedSymbols
      .filter((fs) => isMethodSymbol(fs.symbol))
      .map((fs) => this.parseMethod(text, fs, classComment))
      .filter((m): m is MethodDoc => m !== null)
      .sort((a, b) => a.startLine - b.startLine);

    const fields = flattenedSymbols
      .filter((fs) => isFieldSymbol(fs.symbol))
      .map((fs) => this.parseField(text, fs, classComment))
      .filter((f): f is FieldDoc => f !== null)
      .sort((a, b) => a.startLine - b.startLine);

    const enumConstants = flattenedSymbols
      .filter((fs) => isEnumMemberSymbol(fs.symbol))
      .map((fs) => this.parseEnumConstant(text, fs, classComment))
      .filter((e): e is EnumConstantDoc => e !== null)
      .sort((a, b) => a.startLine - b.startLine);

    // ---- Git 信息（异步，不阻塞主流程） ----
    const gitInfo = await this.getGitInfo(filePath, classLine);

    return {
      className,
      classComment: this.cleanComment(classComment),
      packageName,
      filePath: FilePath(filePath),
      methods,
      fields,
      enumConstants,
      gitInfo,
      javadocAuthor,
      javadocSince,
    };
  }

  // ========== Symbol 树处理 ==========

  /**
   * 递归扁平化 Symbol 树
   *
   * 遇到容器（类/接口/枚举）→ 递归处理其子符号，记录完整类名
   * 遇到方法/字段/枚举常量     → 收集到结果中
   */
  private flattenSymbols(
    symbols: readonly DocumentSymbol[],
    parentName: string,
  ): readonly FlattenedSymbol[] {
    const result: FlattenedSymbol[] = [];

    for (const symbol of symbols) {
      if (isClassLikeSymbol(symbol)) {
        const currentClass = parentName
          ? `${parentName}.${symbol.name}`
          : symbol.name;

        if (symbol.children.length > 0) {
          result.push(...this.flattenSymbols(symbol.children, currentClass));
        }
      } else if (
        isMethodSymbol(symbol) ||
        isFieldSymbol(symbol) ||
        isEnumMemberSymbol(symbol)
      ) {
        result.push({
          symbol,
          belongsTo: parentName || "Unknown",
        });
      }
    }

    return result;
  }

  // ========== 方法解析 ==========

  /**
   * 解析单个方法（包括构造函数）
   *
   * 构造函数与普通方法走同一解析路径，
   * 仅在最终赋值 kind 时通过 isConstructorSymbol 区分
   */
  private parseMethod(
    text: string,
    flattened: FlattenedSymbol,
    classComment: string,
  ): MethodDoc | null {
    try {
      const { symbol, belongsTo } = flattened;
      const lines = text.split("\n");

      const startLine = LineNumber(
        symbol.selectionRange?.start.line ?? symbol.range.start.line,
      );
      const endLine = LineNumber(symbol.range.end.line);

      const fullSignature = this.extractFullSignature(lines, startLine);
      const rawComment = this.extractMemberComment(text, startLine, classComment);
      const hasComment = rawComment.length > 0;

      const { description, tags } = hasComment
        ? this.parseJavadoc(rawComment, fullSignature)
        : { description: "", tags: EMPTY_TAG_TABLE };

      const accessModifier = this.extractAccessModifierFromLine(fullSignature);
      const kind: MethodKind = isConstructorSymbol(symbol)
        ? "constructor"
        : "method";

      const displaySignature =
        symbol.detail || this.extractSignatureFromLine(lines[startLine] ?? "");

      return {
        id: MethodId(`${symbol.name}_${startLine}`),
        kind,
        name: symbol.name,
        signature: displaySignature,
        startLine,
        endLine,
        hasComment,
        description,
        tags,
        belongsTo,
        accessModifier,
      };
    } catch (error) {
      console.error(
        `[JavaDocParser] Failed to parse method: ${flattened.symbol.name}`,
        error,
      );
      return null;
    }
  }

  // ========== 字段解析 ==========

  /**
   * 解析单个字段（普通字段 / static final 常量）
   */
  private parseField(
    text: string,
    flattened: FlattenedSymbol,
    classComment: string,
  ): FieldDoc | null {
    try {
      const { symbol, belongsTo } = flattened;
      const lines = text.split("\n");

      const startLine = LineNumber(
        symbol.selectionRange?.start.line ?? symbol.range.start.line,
      );
      const lineText = lines[startLine]?.trim() ?? "";

      const rawComment = this.extractMemberComment(text, startLine, classComment);
      const hasComment = rawComment.length > 0;
      const description = hasComment ? this.cleanComment(rawComment) : "";

      const isConstant =
        lineText.includes("static") && lineText.includes("final");
      const accessModifier = this.extractAccessModifierFromLine(lineText);
      const fieldType = symbol.detail || this.extractFieldType(lineText);

      return {
        name: symbol.name,
        type: fieldType,
        signature: lineText,
        startLine,
        hasComment,
        description,
        isConstant,
        accessModifier,
        belongsTo,
      };
    } catch (error) {
      console.error(
        `[JavaDocParser] Failed to parse field: ${flattened.symbol.name}`,
        error,
      );
      return null;
    }
  }

  // ========== 枚举常量解析 ==========

  /**
   * 解析单个枚举常量
   *
   * 枚举常量的语法与普通字段完全不同：
   *   SUCCESS(200, "OK"),       ← 有构造参数
   *   PENDING,                  ← 无构造参数
   *   UNKNOWN;                  ← 最后一个用分号
   *
   * 因此不复用 parseField，而是独立解析
   */
  private parseEnumConstant(
    text: string,
    flattened: FlattenedSymbol,
    classComment: string,
  ): EnumConstantDoc | null {
    try {
      const { symbol, belongsTo } = flattened;
      const lines = text.split("\n");

      const startLine = LineNumber(
        symbol.selectionRange?.start.line ?? symbol.range.start.line,
      );
      const lineText = lines[startLine]?.trim() ?? "";

      const rawComment = this.extractMemberComment(text, startLine, classComment);
      const hasComment = rawComment.length > 0;
      const description = hasComment ? this.cleanComment(rawComment) : "";

      const args = this.extractEnumArguments(lineText);

      return {
        name: symbol.name,
        startLine,
        hasComment,
        description,
        arguments: args,
        belongsTo,
      };
    } catch (error) {
      console.error(
        `[JavaDocParser] Failed to parse enum constant: ${flattened.symbol.name}`,
        error,
      );
      return null;
    }
  }

  /**
   * 提取枚举常量的构造参数
   *
   * 使用括号深度匹配，正确处理嵌套括号
   *
   * @example
   *   "SUCCESS(200, \"OK\")" → "(200, \"OK\")"
   *   "PENDING,"             → ""
   *   "UNKNOWN;"             → ""
   */
  private extractEnumArguments(lineText: string): string {
    const openIndex = lineText.indexOf("(");
    if (openIndex === -1) return "";

    let depth = 0;
    for (let i = openIndex; i < lineText.length; i++) {
      const ch = lineText[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          return lineText.slice(openIndex, i + 1);
        }
      }
    }

    // 括号未闭合，返回从 ( 到行尾（去掉末尾的逗号/分号）
    return lineText.slice(openIndex).replace(/[,;]\s*$/, "");
  }

  // ========== Javadoc 注释提取与解析 ==========

  /**
   * 提取成员的 Javadoc 注释（带类注释去重保护）
   *
   * 【为什么需要这个方法？】
   * Lombok 等注解处理器会生成虚拟符号（如 @Slf4j → log 字段），
   * Language Server 将这些符号的位置报告在类声明附近。
   * extractComment 向上搜索时会错误地找到类 Javadoc。
   *
   * 此方法在 extractComment 的基础上增加一层校验：
   * 如果提取到的注释与类注释完全相同，说明是误关联，返回空字符串。
   */
  private extractMemberComment(
    text: string,
    targetLine: number,
    classComment: string,
  ): string {
    const raw = this.extractComment(text, targetLine);
    if (raw.length === 0) return "";

    // 如果与类注释相同，说明是 Lombok 生成符号的误关联
    if (classComment.length > 0 && raw === classComment) return "";

    return raw;
  }

  /**
   * 提取方法/类上方的 Javadoc 注释
   *
   * 搜索策略：从目标行向上搜索，跳过空行和注解，
   * 找到结束标记后继续向上找开始标记，
   * 遇到代码行则说明没有注释
   */
  private extractComment(text: string, targetLine: number): string {
    const lines = text.split("\n");
    let searchLine = targetLine - 1;

    while (searchLine >= 0) {
      const line = lines[searchLine]?.trim() ?? "";

      if (line === "" || this.annotationPattern.test(line)) {
        searchLine--;
        continue;
      }

      if (line.endsWith("*/")) break;

      return "";
    }

    if (searchLine < 0) return "";

    const endLine = searchLine;
    while (searchLine >= 0) {
      const line = lines[searchLine] ?? "";
      if (line.includes("/**")) {
        return lines.slice(searchLine, endLine + 1).join("\n");
      }
      searchLine--;
    }

    return "";
  }

  /**
   * 解析 Javadoc 注释内容
   */
  private parseJavadoc(
    rawComment: string,
    signature: string,
  ): { description: string; tags: TagTable } {
    const cleaned = this.cleanComment(rawComment);
    const tagIndex = cleaned.search(/@\w+/);

    const description =
      tagIndex === -1 ? cleaned : cleaned.slice(0, tagIndex).trim();
    const rawTags = tagIndex === -1 ? "" : cleaned.slice(tagIndex);
    const tags = parseTagTable(rawTags, signature);

    return { description, tags };
  }

  /**
   * 解析类注释中的 @author 和 @since
   */
  private parseClassJavadoc(comment: string): {
    author: string | undefined;
    since: string | undefined;
  } {
    const authorMatch = /@author\s+(.+?)(?:\n|$)/.exec(comment);
    const sinceMatch = /@since\s+(.+?)(?:\n|$)/.exec(comment);

    return {
      author: authorMatch?.[1]?.trim(),
      since: sinceMatch?.[1]?.trim(),
    };
  }

  /**
   * 清理 Javadoc 注释格式
   */
  private cleanComment(raw: string): string {
    return raw
      .replace(/\/\*\*|\*\//g, "")
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, ""))
      .join("\n")
      .trim();
  }

  // ========== 签名提取 ==========

  /**
   * 提取完整的方法签名（处理跨行声明）
   */
  private extractFullSignature(lines: string[], startLine: number): string {
    let signature = "";
    let lineIndex = startLine;
    let parenDepth = 0;
    let foundOpenParen = false;

    while (lineIndex < lines.length) {
      const line = lines[lineIndex] ?? "";

      for (const char of line) {
        signature += char;

        if (char === "(") {
          foundOpenParen = true;
          parenDepth++;
        } else if (char === ")") {
          parenDepth--;
          if (foundOpenParen && parenDepth === 0) {
            return signature.replace(/\s+/g, " ").trim();
          }
        }
      }

      signature += " ";
      lineIndex++;

      if (lineIndex - startLine > 5) break;
    }

    return signature.replace(/\s+/g, " ").trim();
  }

  /**
   * 从代码行中提取方法签名（去除方法体）
   */
  private extractSignatureFromLine(line: string): string {
    const withoutBody = line.replace(/\{.*$/, "").trim();
    return withoutBody || line;
  }

  // ========== 辅助方法 ==========

  private extractAccessModifierFromLine(line: string): AccessModifier {
    if (line.includes("public ")) return "public";
    if (line.includes("protected ")) return "protected";
    if (line.includes("private ")) return "private";
    return "default";
  }

  private extractClassNameFromText(text: string): string {
    const match = /(?:class|interface|enum)\s+(\w+)/.exec(text);
    return match?.[1] ?? "Unknown";
  }

  /**
   * 从字段声明行提取类型
   * 例如: "private static final int MAX_SIZE = 100;" → "int"
   */
  private extractFieldType(line: string): string {
    const withoutAssign = line.split("=")[0] ?? "";
    const withoutSemicolon = withoutAssign.replace(/;$/, "").trim();
    const parts = withoutSemicolon.split(/\s+/);
    if (parts.length >= 2) {
      return parts[parts.length - 2] ?? "unknown";
    }
    return "unknown";
  }

  private extractPackageName(text: string): string {
    const match = /package\s+([\w.]+);/.exec(text);
    return match?.[1] ?? "";
  }

  // ========== Git 集成 ==========

  private async getGitInfo(
    filePath: string,
    classLine: number,
  ): Promise<GitAuthorInfo | undefined> {
    try {
      const isGitRepo = await gitService.isGitRepository(filePath);
      if (!isGitRepo) return undefined;

      const info = await gitService.getClassGitInfo(filePath, classLine);
      if (!info) return undefined;

      return {
        author: info.author,
        lastModifier: info.lastModifier,
        lastModifyDate: info.lastModifyDate,
      };
    } catch {
      return undefined;
    }
  }
}

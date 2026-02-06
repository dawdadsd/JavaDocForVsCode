"use strict";
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
 * TextDocument → Symbol树 → 扁平化方法列表 → 提取每个方法的Javadoc → ClassDoc
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavaDocParser = void 0;
const path = __importStar(require("path"));
const SymbolResolver_js_1 = require("./SymbolResolver.js");
const TagParser_js_1 = require("./TagParser.js");
const GitService_js_1 = require("../services/GitService.js");
const types_js_1 = require("../types.js");
/**
 * Javadoc 解析器类
 */
class JavaDocParser {
    // 匹配 Javadoc 注释块 /** ... */
    javadocPattern = /\/\*\*[\s\S]*?\*\//;
    // 匹配 Java 注解 @Override, @Transactional 等
    annotationPattern = /^\s*@[\w.]+/;
    // 顶层类型声明（class/interface/enum/record/@interface）匹配
    topLevelTypePattern = /^\s*(?:@[\w.]+(?:\([^)]*\))?\s+)*(?:(?:public|protected|private|abstract|final|static|sealed|non-sealed|strictfp)\s+)*(?:class|interface|enum|record|@interface)\s+([A-Za-z_$][\w$]*)\b/;
    /**
     * 解析 Java 文档
     *
     * @param document - VS Code 的文档对象
     * @returns 解析后的类文档结构
     */
    async parse(document) {
        // 步骤 1：获取 Symbol 树
        const symbols = await (0, SymbolResolver_js_1.resolveSymbols)(document.uri);
        const text = document.getText();
        const filePath = document.uri.fsPath;
        // 步骤 2：提取类信息
        const classSymbol = this.findClassSymbol(symbols, filePath);
        const fallbackClassInfo = classSymbol
            ? null
            : this.extractPrimaryTypeInfoFromText(text, filePath);
        const className = classSymbol?.name ??
            fallbackClassInfo?.className ??
            this.extractClassNameFromText(text);
        const packageName = this.extractPackageName(text);
        const classLine = classSymbol?.selectionRange?.start.line ??
            classSymbol?.range.start.line ??
            fallbackClassInfo?.classLine ??
            0;
        // 提取类注释
        const classComment = (classSymbol ? this.extractComment(text, classLine) : "") ||
            fallbackClassInfo?.classComment ||
            "";
        // 解析类注释中的 @author 和 @since
        const classJavadoc = this.parseClassJavadoc(classComment);
        // 步骤 3：扁平化 Symbol 树，提取所有方法
        const flattenedSymbols = this.flattenSymbols(symbols, "");
        // 步骤 4：解析每个方法的 Javadoc
        const methods = flattenedSymbols
            .filter((fs) => (0, SymbolResolver_js_1.isMethodSymbol)(fs.symbol))
            .map((fs) => this.parseMethod(text, fs))
            .filter((m) => m !== null) // 过滤掉解析失败的
            .sort((a, b) => a.startLine - b.startLine); // 按行号排序
        // 步骤 4.5：解析每个字段的 Javadoc
        const fields = flattenedSymbols
            .filter((fs) => (0, SymbolResolver_js_1.isFieldSymbol)(fs.symbol))
            .map((fs) => this.parseField(text, fs))
            .filter((f) => f !== null)
            .sort((a, b) => a.startLine - b.startLine);
        // 步骤 5：获取 Git 信息（异步，不阻塞）
        const gitInfo = await this.getGitInfo(filePath, classLine);
        return {
            className,
            classComment: this.cleanComment(classComment),
            packageName,
            filePath: (0, types_js_1.FilePath)(filePath),
            methods,
            fields,
            gitInfo,
            javadocAuthor: classJavadoc.author,
            javadocSince: classJavadoc.since,
        };
    }
    /**
     * 获取 Git 作者信息
     */
    async getGitInfo(filePath, classLine) {
        try {
            const isGitRepo = await GitService_js_1.gitService.isGitRepository(filePath);
            if (!isGitRepo)
                return undefined;
            const info = await GitService_js_1.gitService.getClassGitInfo(filePath, classLine);
            if (!info)
                return undefined;
            return {
                author: info.author,
                lastModifier: info.lastModifier,
                lastModifyDate: info.lastModifyDate,
            };
        }
        catch {
            return undefined;
        }
    }
    /**
     * 解析类注释中的 @author 和 @since
     */
    parseClassJavadoc(comment) {
        const authorMatch = /@author\s+(.+?)(?:\n|$)/.exec(comment);
        const sinceMatch = /@since\s+(.+?)(?:\n|$)/.exec(comment);
        return {
            author: authorMatch?.[1]?.trim(),
            since: sinceMatch?.[1]?.trim(),
        };
    }
    /**
     * 递归扁平化 Symbol 树
     *
     * @param symbols - 当前层级的符号列表
     * @param parentName - 父类名（用于拼接 belongsTo）
     *
     * 【递归逻辑】
     * 遇到类/接口 → 递归处理其子符号，并记录类名
     * 遇到方法 → 收集到结果中
     * 其他（字段等）→ 忽略
     */
    flattenSymbols(symbols, parentName) {
        const result = [];
        for (const symbol of symbols) {
            if ((0, SymbolResolver_js_1.isClassLikeSymbol)(symbol)) {
                // 构建完整类名：如果有父类，用点号连接
                const currentClass = parentName
                    ? `${parentName}.${symbol.name}`
                    : symbol.name;
                // 递归处理内部类的成员
                if (symbol.children.length > 0) {
                    result.push(...this.flattenSymbols(symbol.children, currentClass));
                }
            }
            else if ((0, SymbolResolver_js_1.isMethodSymbol)(symbol)) {
                // 收集方法
                result.push({
                    symbol,
                    belongsTo: parentName || "Unknown",
                });
            }
            else if ((0, SymbolResolver_js_1.isFieldSymbol)(symbol)) {
                result.push({
                    symbol,
                    belongsTo: parentName || "Unknown",
                });
            }
        }
        return result;
    }
    /**
     * 解析单个方法
     *
     * @param text - 文件完整文本
     * @param flattened - 扁平化后的方法符号
     * @returns 方法文档，解析失败返回 null
     */
    parseMethod(text, flattened) {
        try {
            const { symbol, belongsTo } = flattened;
            const lines = text.split("\n");
            // 使用 selectionRange 获取方法名所在行（更准确）
            const startLine = (0, types_js_1.LineNumber)(symbol.selectionRange?.start.line ?? symbol.range.start.line);
            const endLine = (0, types_js_1.LineNumber)(symbol.range.end.line);
            // 获取完整的方法签名（可能跨多行）
            const fullSignature = this.extractFullSignature(lines, startLine);
            // 提取方法上方的 Javadoc 注释
            const rawComment = this.extractComment(text, startLine);
            const hasComment = rawComment.length > 0;
            // 使用源代码中的完整签名来解析参数类型（而不是 symbol.detail）
            const { description, tags } = hasComment
                ? this.parseJavadoc(rawComment, fullSignature)
                : { description: "", tags: types_js_1.EMPTY_TAG_TABLE };
            // 提取访问修饰符
            const accessModifier = this.extractAccessModifierFromLine(fullSignature);
            // 生成唯一 ID
            const id = (0, types_js_1.MethodId)(`${symbol.name}_${startLine}`);
            // 显示用的签名使用 symbol.detail（更简洁）或提取的签名
            const displaySignature = symbol.detail || this.extractSignatureFromLine(lines[startLine] ?? "");
            return {
                id,
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
        }
        catch (error) {
            console.error(`[JavaDocParser] Failed to parse method: ${flattened.symbol.name}`, error);
            return null;
        }
    }
    /**
     * 解析单个字段
     *
     * @param text - 文件完整文本
     * @param flattened - 扁平化后的字段符号
     * @returns 字段文档，解析失败返回 null
     */
    parseField(text, flattened) {
        try {
            const { symbol, belongsTo } = flattened;
            const lines = text.split("\n");
            const startLine = (0, types_js_1.LineNumber)(symbol.selectionRange?.start.line ?? symbol.range.start.line);
            const lineText = lines[startLine]?.trim() ?? "";
            const rawComment = this.extractComment(text, startLine);
            const hasComment = rawComment.length > 0;
            const description = hasComment ? this.cleanComment(rawComment) : "";
            const isConstant = lineText.includes("static") && lineText.includes("final");
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
        }
        catch (error) {
            console.error(`[JavaDocParser] Failed to parse field: ${flattened.symbol.name}`, error);
            return null;
        }
    }
    /**
     * 提取完整的方法签名（处理跨行情况）
     * 返回从方法名到右括号的完整签名，去除换行符
     */
    extractFullSignature(lines, startLine) {
        let signature = "";
        let lineIndex = startLine;
        let parenDepth = 0;
        let foundOpenParen = false;
        // 从方法声明行开始，收集到右括号为止
        while (lineIndex < lines.length) {
            const line = lines[lineIndex] ?? "";
            for (const char of line) {
                signature += char;
                if (char === "(") {
                    foundOpenParen = true;
                    parenDepth++;
                }
                else if (char === ")") {
                    parenDepth--;
                    if (foundOpenParen && parenDepth === 0) {
                        // 找到完整的方法签名，规范化空白字符
                        return signature.replace(/\s+/g, " ").trim();
                    }
                }
            }
            // 添加空格替代换行
            signature += " ";
            lineIndex++;
            // 最多查找5行，防止无限循环
            if (lineIndex - startLine > 5)
                break;
        }
        // 如果没找到完整括号，返回规范化后的内容
        return signature.replace(/\s+/g, " ").trim();
    }
    /**
     * 提取方法/类上方的 Javadoc 注释
     *
     * 搜索策略：
     * 从目标行向上搜索，跳过空行和注解
     * 找到注释结束标记后，继续向上找注释开始标记
     * 如果遇到代码行（如上一个方法的右花括号），则说明没有注释
     *
     * @param text - 文件完整文本
     * @param targetLine - 目标行号（方法/类定义所在行）
     */
    extractComment(text, targetLine) {
        const lines = text.split("\n");
        // 从目标行向上找最近的 "*/"，并要求注释后到目标行之间仅包含空行或注解块。
        for (let endLine = targetLine - 1; endLine >= 0; endLine--) {
            const trimmed = lines[endLine]?.trim() ?? "";
            if (trimmed === "")
                continue;
            if (!trimmed.endsWith("*/"))
                continue;
            const between = lines.slice(endLine + 1, targetLine);
            if (!this.onlyBlankOrAnnotations(between))
                continue;
            // 从 endLine 向上找对应的 "/**"
            for (let startLine = endLine; startLine >= 0; startLine--) {
                const line = lines[startLine] ?? "";
                if (line.includes("/**")) {
                    return lines.slice(startLine, endLine + 1).join("\n");
                }
                // 遇到另一个块注释结束，说明不在同一个注释块内了
                if (startLine !== endLine && line.includes("*/"))
                    break;
            }
        }
        return "";
    }
    /**
     * 判断一段代码是否仅由空行或注解（含多行注解参数）构成
     */
    onlyBlankOrAnnotations(lines) {
        let i = 0;
        while (i < lines.length) {
            const line = lines[i]?.trim() ?? "";
            if (line === "") {
                i++;
                continue;
            }
            if (!this.annotationPattern.test(line)) {
                return false;
            }
            // 处理多行注解：@Anno( ... ) 可能跨多行
            const openParens = lines[i]?.match(/\(/g)?.length ?? 0;
            const closeParens = lines[i]?.match(/\)/g)?.length ?? 0;
            let parenDepth = openParens - closeParens;
            i++;
            while (i < lines.length && parenDepth > 0) {
                const next = lines[i] ?? "";
                const nextOpen = next.match(/\(/g)?.length ?? 0;
                const nextClose = next.match(/\)/g)?.length ?? 0;
                parenDepth += nextOpen - nextClose;
                i++;
            }
        }
        return true;
    }
    /**
     * 解析 Javadoc 内容
     *
     * @param rawComment - 原始注释文本（包含开始和结束标记）
     * @param signature - 方法签名
     */
    parseJavadoc(rawComment, signature) {
        // 清理注释格式
        const cleaned = this.cleanComment(rawComment);
        // 找到第一个 @tag 的位置
        const tagIndex = cleaned.search(/@\w+/);
        // 分离描述和标签
        const description = tagIndex === -1 ? cleaned : cleaned.slice(0, tagIndex).trim();
        const rawTags = tagIndex === -1 ? "" : cleaned.slice(tagIndex);
        // 解析标签
        const tags = (0, TagParser_js_1.parseTagTable)(rawTags, signature);
        return { description, tags };
    }
    /**
     * 清理 Javadoc 注释格式
     *
     * 移除注释的开始结束标记，以及每行开头的星号
     */
    cleanComment(raw) {
        return raw
            .replace(/\/\*\*|\*\//g, "") // 移除 /** 和 */
            .split("\n")
            .map((line) => line.replace(/^\s*\*\s?/, "")) // 移除每行开头的 " * "
            .join("\n")
            .trim();
    }
    /**
     * 提取访问修饰符
     */
    extractAccessModifier(detail) {
        if (detail.startsWith("public"))
            return "public";
        if (detail.startsWith("protected"))
            return "protected";
        if (detail.startsWith("private"))
            return "private";
        return "default"; // 包级私有
    }
    /**
     * 从代码行中提取访问修饰符（更可靠）
     */
    extractAccessModifierFromLine(line) {
        if (line.includes("public "))
            return "public";
        if (line.includes("protected "))
            return "protected";
        if (line.includes("private "))
            return "private";
        return "default";
    }
    /**
     * 从代码行中提取方法签名
     */
    extractSignatureFromLine(line) {
        // 移除方法体部分（如果在同一行）
        const withoutBody = line.replace(/\{.*$/, "").trim();
        return withoutBody || line;
    }
    /**
     * 从 Symbol 列表中找到类符号
     */
    findClassSymbol(symbols, filePath) {
        const classLikes = symbols.filter((s) => (0, SymbolResolver_js_1.isClassLikeSymbol)(s));
        if (classLikes.length === 0)
            return undefined;
        const baseName = path.basename(filePath, path.extname(filePath));
        const matched = classLikes.find((s) => s.name === baseName);
        return matched ?? classLikes[0];
    }
    /**
     * 从文本中提取类名（Symbol 解析失败时的降级方案）
     */
    extractClassNameFromText(text) {
        const match = /(?:class|interface|enum)\s+(\w+)/.exec(text);
        return match?.[1] ?? "Unknown";
    }
    /**
     * 当符号解析失败时，从源码文本中提取“主类型”(top-level)信息
     *
     * - 只识别 braceDepth===0 的类型声明，避免误选内部类
     * - 优先选择与文件名同名的类型（常见 Java 约定）
     */
    extractPrimaryTypeInfoFromText(text, filePath) {
        const lines = text.split("\n");
        const baseName = path.basename(filePath, path.extname(filePath));
        let braceDepth = 0;
        let state = {
            inBlockComment: false,
            inString: false,
            inChar: false,
        };
        let first = null;
        let preferred = null;
        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i] ?? "";
            const parsed = this.parseLineForStructure(rawLine, state);
            state = parsed.state;
            if (braceDepth === 0) {
                const match = this.topLevelTypePattern.exec(parsed.code);
                if (match?.[1]) {
                    const name = match[1];
                    const line = i;
                    first ??= { name, line };
                    if (name === baseName) {
                        preferred = { name, line };
                        break;
                    }
                }
            }
            braceDepth += parsed.openBraces - parsed.closeBraces;
        }
        const chosen = preferred ?? first;
        const className = chosen?.name ?? "Unknown";
        const classLine = chosen?.line ?? 0;
        const classComment = this.extractComment(text, classLine);
        return { className, classLine, classComment };
    }
    /**
     * 用于顶层扫描时剔除注释/字符串，避免 braceDepth 计算误差
     */
    parseLineForStructure(line, state) {
        let code = "";
        let openBraces = 0;
        let closeBraces = 0;
        let inBlockComment = state.inBlockComment;
        let inString = state.inString;
        let inChar = state.inChar;
        let escaped = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i] ?? "";
            const next = line[i + 1] ?? "";
            if (inBlockComment) {
                if (ch === "*" && next === "/") {
                    inBlockComment = false;
                    i++;
                }
                continue;
            }
            if (inString) {
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (ch === "\\") {
                    escaped = true;
                    continue;
                }
                if (ch === '"') {
                    inString = false;
                }
                continue;
            }
            if (inChar) {
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (ch === "\\") {
                    escaped = true;
                    continue;
                }
                if (ch === "'") {
                    inChar = false;
                }
                continue;
            }
            // 行注释：忽略剩余内容
            if (ch === "/" && next === "/") {
                break;
            }
            // 块注释开始
            if (ch === "/" && next === "*") {
                inBlockComment = true;
                i++;
                continue;
            }
            if (ch === '"') {
                inString = true;
                continue;
            }
            if (ch === "'") {
                inChar = true;
                continue;
            }
            if (ch === "{")
                openBraces++;
            if (ch === "}")
                closeBraces++;
            code += ch;
        }
        return {
            code,
            openBraces,
            closeBraces,
            state: { inBlockComment, inString, inChar },
        };
    }
    /**
     * 从字段声明行提取类型
     * 例如: "private static final int MAX_SIZE = 100;" -> "int"
     */
    extractFieldType(line) {
        const withoutAssign = line.split("=")[0] ?? "";
        const withoutSemicolon = withoutAssign.replace(/;$/, "").trim();
        const parts = withoutSemicolon.split(/\s+/);
        if (parts.length >= 2) {
            return parts[parts.length - 2] ?? "unknown";
        }
        return "unknown";
    }
    /**
     * 提取包名
     */
    extractPackageName(text) {
        const match = /package\s+([\w.]+);/.exec(text);
        return match?.[1] ?? "";
    }
}
exports.JavaDocParser = JavaDocParser;
//# sourceMappingURL=JavaDocParser.js.map
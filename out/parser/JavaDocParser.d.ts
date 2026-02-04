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
import type { TextDocument } from 'vscode';
import type { ClassDoc } from '../types.js';
/**
 * Javadoc 解析器类
 */
export declare class JavaDocParser {
    private readonly javadocPattern;
    private readonly annotationPattern;
    /**
     * 解析 Java 文档
     *
     * @param document - VS Code 的文档对象
     * @returns 解析后的类文档结构
     */
    parse(document: TextDocument): Promise<ClassDoc>;
    /**
     * 获取 Git 作者信息
     */
    private getGitInfo;
    /**
     * 解析类注释中的 @author 和 @since
     */
    private parseClassJavadoc;
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
    private flattenSymbols;
    /**
     * 解析单个方法
     *
     * @param text - 文件完整文本
     * @param flattened - 扁平化后的方法符号
     * @returns 方法文档，解析失败返回 null
     */
    private parseMethod;
    /**
     * 提取完整的方法签名（处理跨行情况）
     * 返回从方法名到右括号的完整签名，去除换行符
     */
    private extractFullSignature;
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
    private extractComment;
    /**
     * 解析 Javadoc 内容
     *
     * @param rawComment - 原始注释文本（包含开始和结束标记）
     * @param signature - 方法签名
     */
    private parseJavadoc;
    /**
     * 清理 Javadoc 注释格式
     *
     * 移除注释的开始结束标记，以及每行开头的星号
     */
    private cleanComment;
    /**
     * 提取访问修饰符
     */
    private extractAccessModifier;
    /**
     * 从代码行中提取访问修饰符（更可靠）
     */
    private extractAccessModifierFromLine;
    /**
     * 从代码行中提取方法签名
     */
    private extractSignatureFromLine;
    /**
     * 从 Symbol 列表中找到类符号
     */
    private findClassSymbol;
    /**
     * 从文本中提取类名（Symbol 解析失败时的降级方案）
     */
    private extractClassNameFromText;
    /**
     * 提取包名
     */
    private extractPackageName;
}

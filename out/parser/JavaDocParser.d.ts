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
import type { TextDocument } from "vscode";
import type { ClassDoc } from "../types.js";
/**
 * Javadoc 解析器
 */
export declare class JavaDocParser {
    /** 匹配 Java 注解 @Override, @Transactional 等 */
    private readonly annotationPattern;
    /**
     * 解析 Java 文档
     *
     * @param document - VS Code 的文档对象
     * @returns 解析后的类文档结构
     */
    parse(document: TextDocument): Promise<ClassDoc>;
    /**
     * 递归扁平化 Symbol 树
     *
     * 遇到容器（类/接口/枚举）→ 递归处理其子符号，记录完整类名
     * 遇到方法/字段/枚举常量     → 收集到结果中
     */
    private flattenSymbols;
    /**
     * 解析单个方法（包括构造函数）
     *
     * 构造函数与普通方法走同一解析路径，
     * 仅在最终赋值 kind 时通过 isConstructorSymbol 区分
     */
    private parseMethod;
    /**
     * 解析单个字段（普通字段 / static final 常量）
     */
    private parseField;
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
    private parseEnumConstant;
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
    private extractEnumArguments;
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
    private extractMemberComment;
    /**
     * 提取方法/类上方的 Javadoc 注释
     *
     * 搜索策略：从目标行向上搜索，跳过空行和注解，
     * 找到结束标记后继续向上找开始标记，
     * 遇到代码行则说明没有注释
     */
    private extractComment;
    /**
     * 解析 Javadoc 注释内容
     */
    private parseJavadoc;
    /**
     * 解析类注释中的 @author 和 @since
     */
    private parseClassJavadoc;
    /**
     * 清理 Javadoc 注释格式
     */
    private cleanComment;
    /**
     * 提取完整的方法签名（处理跨行声明）
     *
     * Spring Controller 方法带多个注解参数时，签名可能跨越 8-10 行，例如：
     *   public ResponseEntity<User> updateUser(
     *       @PathVariable Long id,
     *       @RequestBody @Valid UserUpdateDTO dto,
     *       @RequestParam(required = false) String reason,
     *       @AuthenticationPrincipal UserDetails principal
     *   ) {
     *
     * 上限设为 15 行，覆盖绝大多数实际方法签名
     */
    private static readonly MAX_SIGNATURE_LINES;
    private extractFullSignature;
    /**
     * 从代码行中提取方法签名（去除方法体）
     */
    private extractSignatureFromLine;
    private extractAccessModifierFromLine;
    private extractClassNameFromText;
    /**
     * 从字段声明行提取类型
     * 例如: "private static final int MAX_SIZE = 100;" → "int"
     */
    private extractFieldType;
    private extractPackageName;
    private getGitInfo;
}

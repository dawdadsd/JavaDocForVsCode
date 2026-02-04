"use strict";
/**
 * TagParser.ts - Javadoc 标签解析器
 *
 * 【Javadoc 标签格式】
 * @param paramName 参数描述
 * @return 返回值描述
 * @throws ExceptionType 异常描述
 * @since 1.0
 * @author 作者名
 *
 * 本模块负责将原始文本解析成结构化的 TagTable
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTagTable = parseTagTable;
const types_js_1 = require("../types.js");
/**
 * 解析 Javadoc 标签
 *
 * @param rawTags - 原始标签文本（从第一个 @tag 开始）
 * @param signature - 方法签名（用于提取类型信息）
 * @returns 结构化的标签表格
 *
 * @example
 * const raw = '@param id 用户ID\n@return 用户对象';
 * const sig = 'public User findById(Long id)';
 * parseTagTable(raw, sig);
 * // 返回: { params: [{name:'id', type:'Long', description:'用户ID'}], ... }
 */
function parseTagTable(rawTags, signature) {
    // 空文本直接返回空表格
    if (!rawTags.trim()) {
        return types_js_1.EMPTY_TAG_TABLE;
    }
    // 从方法签名中提取参数类型映射
    // 例如：'public void save(Long id, String name)' => Map { 'id' => 'Long', 'name' => 'String' }
    const paramTypes = parseSignatureParams(signature);
    // 从方法签名中提取返回类型
    const returnType = parseReturnType(signature);
    // 初始化结果容器
    const params = [];
    const throws = [];
    const see = [];
    let returns = null;
    let since = null;
    let author = null;
    let deprecated = null;
    // 【正则解释】
    // /@(param|return|...)\\s+/ 匹配 @标签名 加至少一个空白字符
    // 使用 split 分割后，奇数位置是标签名，偶数位置是内容
    const tagPattern = /@(param|return|returns|throws|exception|since|author|deprecated|see)\s+/g;
    const segments = rawTags.split(tagPattern);
    // segments 结构示例：
    // 输入: '@param id 描述\n@return 返回值'
    // 分割: ['', 'param', 'id 描述\n', 'return', '返回值']
    //        0     1          2           3          4
    // 所以从 index=1 开始，步长为 2
    for (let i = 1; i < segments.length; i += 2) {
        const tagName = segments[i]; // 标签名
        const content = segments[i + 1]?.trim() ?? ''; // 标签内容
        // 根据标签类型分别处理
        switch (tagName) {
            case 'param': {
                const param = parseParamTag(content, paramTypes);
                if (param) {
                    params.push(param);
                }
                break;
            }
            case 'return':
            case 'returns': {
                // void 方法不需要 @return
                if (returnType !== 'void') {
                    returns = { type: returnType, description: content };
                }
                break;
            }
            case 'throws':
            case 'exception': {
                // @throws 和 @exception 是同义词
                const throwsTag = parseThrowsTag(content);
                if (throwsTag) {
                    throws.push(throwsTag);
                }
                break;
            }
            case 'since':
                since = content;
                break;
            case 'author':
                author = content;
                break;
            case 'deprecated':
                deprecated = content;
                break;
            case 'see':
                see.push(content);
                break;
        }
    }
    return { params, returns, throws, since, author, deprecated, see };
}
/**
 * 解析单个 @param 标签
 *
 * @param content - 标签内容，格式："paramName 描述文字"
 * @param paramTypes - 参数名到类型的映射
 */
function parseParamTag(content, paramTypes) {
    // 匹配：参数名（单词） + 空格 + 剩余描述
    // /s 标志让 . 也能匹配换行符（处理多行描述）
    const match = /^(\w+)\s*(.*)$/s.exec(content);
    if (!match) {
        return null;
    }
    const name = match[1] ?? '';
    const description = match[2]?.trim() ?? '';
    // 从签名中查找类型，找不到用 'unknown'
    const type = paramTypes.get(name) ?? 'unknown';
    return { name, type, description };
}
/**
 * 解析单个 @throws 标签
 *
 * @param content - 标签内容，格式："ExceptionType 描述文字"
 */
function parseThrowsTag(content) {
    // 匹配：异常类型（可含包名，如 java.io.IOException） + 空格 + 描述
    const match = /^([\w.]+)\s*(.*)$/s.exec(content);
    if (!match) {
        return null;
    }
    return {
        type: match[1] ?? '',
        description: match[2]?.trim() ?? '',
    };
}
/**
 * 从方法签名中提取参数类型映射
 *
 * @example
 * parseSignatureParams('public void save(Long id, String name)')
 * // 返回: Map { 'id' => 'Long', 'name' => 'String' }
 *
 * 【处理泛型的挑战】
 * 签名：public void process(Map<String, List<User>> data, int count)
 * 不能简单按逗号分割，因为泛型内部也有逗号
 * 需要用栈来追踪 < > 的嵌套层级
 */
function parseSignatureParams(signature) {
    const map = new Map();
    // 提取括号内的参数列表
    const paramsMatch = /\(([^)]*)\)/.exec(signature);
    if (!paramsMatch?.[1]) {
        return map;
    }
    const paramsStr = paramsMatch[1];
    // 按逗号分割，但要处理泛型中的逗号
    const params = splitParams(paramsStr);
    for (const param of params) {
        const trimmed = param.trim();
        if (!trimmed)
            continue;
        // 参数格式："Type name" 或 "Type<Generic> name"
        // 最后一个空格分隔类型和名称
        const lastSpace = trimmed.lastIndexOf(' ');
        if (lastSpace === -1)
            continue;
        const type = trimmed.slice(0, lastSpace).trim();
        const name = trimmed.slice(lastSpace + 1).trim();
        if (name && type) {
            map.set(name, type);
        }
    }
    return map;
}
/**
 * 智能分割参数列表（处理泛型中的逗号）
 *
 * @example
 * splitParams('Map<String, Integer> map, int count')
 * // 返回: ['Map<String, Integer> map', 'int count']
 * // 注意：Map<String, Integer> 中的逗号不会被分割
 */
function splitParams(paramsStr) {
    const result = [];
    let current = '';
    let depth = 0; // 追踪 < > 的嵌套深度
    for (const char of paramsStr) {
        if (char === '<') {
            depth++; // 进入泛型
            current += char;
        }
        else if (char === '>') {
            depth--; // 离开泛型
            current += char;
        }
        else if (char === ',' && depth === 0) {
            // 只有在最外层（不在泛型内）才按逗号分割
            result.push(current);
            current = '';
        }
        else {
            current += char;
        }
    }
    // 别忘了最后一个参数
    if (current.trim()) {
        result.push(current);
    }
    return result;
}
/**
 * 从方法签名中提取返回类型
 *
 * @example
 * parseReturnType('public User findById(Long id)')      // 'User'
 * parseReturnType('public List<User> findAll()')        // 'List<User>'
 * parseReturnType('public void save(User user)')        // 'void'
 * parseReturnType('public <T> T convert(Object o)')     // 'T'
 */
function parseReturnType(signature) {
    // 移除方法体部分
    const cleanSig = signature.replace(/\{.*$/, '').trim();
    // 移除方法级泛型声明 <T, U>（在返回类型之前）
    const withoutGenericDecl = cleanSig.replace(/<[^>]+>\s*(?=\w+\s*\()/, '');
    // 尝试匹配：修饰符... 返回类型 方法名(
    const match = /(?:public|private|protected|static|final|abstract|synchronized|\s)*\s*([\w<>\[\],\s?]+?)\s+\w+\s*\(/.exec(withoutGenericDecl);
    if (match?.[1]) {
        return match[1].trim();
    }
    // 备用方案：直接提取括号前的最后一个类型
    // 例如：User findById(Long id) -> 提取 User
    const fallbackMatch = /([\w<>\[\]]+)\s+\w+\s*\(/.exec(withoutGenericDecl);
    return fallbackMatch?.[1]?.trim() ?? 'void';
}
//# sourceMappingURL=TagParser.js.map
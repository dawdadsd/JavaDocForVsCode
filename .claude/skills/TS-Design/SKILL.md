# TypeScript VS Code Extension Development Skill (2026 Edition)

> **版本**: v1.0
> **适用项目**: JavaDoc Sidebar VS Code Extension
> **TypeScript 版本**: 5.5+
> **Node.js 版本**: 20+
> **VS Code Engine**: ^1.95.0

---

## 1. 项目配置与工具链

### 1.1 tsconfig.json 严格配置

```jsonc
{
  "compilerOptions": {
    // 2026 年标准：ES2024 + NodeNext
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2024"],

    // 严格模式 - 全部开启
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,

    // 输出配置
    "outDir": "./out",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // VS Code 扩展特定
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "out", "**/*.test.ts"]
}
```

### 1.2 ESLint 配置 (Flat Config)

```typescript
// eslint.config.js
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 2026 硅谷标准规则
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'interface', format: ['PascalCase'], prefix: [] },
        { selector: 'typeAlias', format: ['PascalCase'] },
        { selector: 'enum', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
      ],
    },
  }
);
```

---

## 2. 类型系统设计原则

### 2.1 使用 Branded Types 确保类型安全

```typescript
// src/types.ts

/**
 * Branded Type 模式 - 防止原始类型混淆
 */
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

// 行号类型 - 防止与普通数字混淆
export type LineNumber = Brand<number, 'LineNumber'>;

// 方法 ID 类型
export type MethodId = Brand<string, 'MethodId'>;

// 文件路径类型
export type FilePath = Brand<string, 'FilePath'>;

// 构造函数
export const LineNumber = (n: number): LineNumber => n as LineNumber;
export const MethodId = (s: string): MethodId => s as MethodId;
export const FilePath = (s: string): FilePath => s as FilePath;
```

### 2.2 使用 Discriminated Unions 处理消息协议

```typescript
// src/types.ts

/**
 * Extension → Webview 下行消息
 * 使用 discriminated union 确保类型安全的消息处理
 */
export type DownstreamMessage =
  | { readonly type: 'updateView'; readonly payload: ClassDoc }
  | { readonly type: 'highlightMethod'; readonly payload: { id: MethodId } }
  | { readonly type: 'clearView' };

/**
 * Webview → Extension 上行消息
 */
export type UpstreamMessage =
  | { readonly type: 'jumpToLine'; readonly payload: { line: LineNumber } }
  | { readonly type: 'webviewReady' };

/**
 * 类型守卫 - 运行时类型检查
 */
export function isUpstreamMessage(value: unknown): value is UpstreamMessage {
  if (typeof value !== 'object' || value === null) return false;
  const msg = value as Record<string, unknown>;

  return (
    (msg['type'] === 'jumpToLine' &&
     typeof msg['payload'] === 'object' &&
     msg['payload'] !== null &&
     typeof (msg['payload'] as Record<string, unknown>)['line'] === 'number') ||
    (msg['type'] === 'webviewReady')
  );
}
```

### 2.3 使用 const 断言和 satisfies 操作符

```typescript
// src/constants.ts

/**
 * 访问修饰符常量 - 使用 as const + satisfies 双重约束
 */
export const ACCESS_MODIFIERS = ['public', 'protected', 'private', 'default'] as const satisfies readonly string[];
export type AccessModifier = (typeof ACCESS_MODIFIERS)[number];

/**
 * 配置默认值 - 类型安全的配置对象
 */
export const DEFAULT_CONFIG = {
  debounceDelay: 300,
  maxMethods: 200,
  enableAutoHighlight: true,
  defaultCollapsed: false,
} as const satisfies Readonly<ExtensionConfig>;

export interface ExtensionConfig {
  readonly debounceDelay: number;
  readonly maxMethods: number;
  readonly enableAutoHighlight: boolean;
  readonly defaultCollapsed: boolean;
}
```

### 2.4 核心数据结构定义

```typescript
// src/types.ts

/**
 * 参数标签
 */
export interface ParamTag {
  readonly name: string;
  readonly type: string;
  readonly description: string;
}

/**
 * 返回值标签
 */
export interface ReturnTag {
  readonly type: string;
  readonly description: string;
}

/**
 * 异常标签
 */
export interface ThrowsTag {
  readonly type: string;
  readonly description: string;
}

/**
 * 标签表格 - 结构化的 Javadoc 标签
 */
export interface TagTable {
  readonly params: readonly ParamTag[];
  readonly returns: ReturnTag | null;
  readonly throws: readonly ThrowsTag[];
  readonly since: string | null;
  readonly author: string | null;
  readonly deprecated: string | null;
  readonly see: readonly string[];
}

/**
 * 方法文档
 */
export interface MethodDoc {
  readonly id: MethodId;
  readonly name: string;
  readonly signature: string;
  readonly startLine: LineNumber;
  readonly endLine: LineNumber;
  readonly hasComment: boolean;
  readonly description: string;
  readonly tags: TagTable;
  readonly belongsTo: string;
  readonly accessModifier: AccessModifier;
}

/**
 * 类文档 - 顶层数据结构
 */
export interface ClassDoc {
  readonly className: string;
  readonly classComment: string;
  readonly packageName: string;
  readonly filePath: FilePath;
  readonly methods: readonly MethodDoc[];
}

/**
 * 空标签表格 - 使用 satisfies 确保类型完整
 */
export const EMPTY_TAG_TABLE = {
  params: [],
  returns: null,
  throws: [],
  since: null,
  author: null,
  deprecated: null,
  see: [],
} as const satisfies TagTable;
```

---

## 3. 核心模块实现模式

### 3.1 Extension 入口 - 生命周期管理

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider.js';
import type { Disposable } from 'vscode';

/**
 * 扩展激活函数
 *
 * 设计原则：
 * 1. 单一职责 - 仅负责注册和连接各模块
 * 2. 依赖注入 - Provider 和监听器通过参数传递依赖
 * 3. 资源追踪 - 所有 Disposable 加入 subscriptions
 */
export function activate(context: vscode.ExtensionContext): void {
  const sidebarProvider = new SidebarProvider(context.extensionUri);

  // 注册 WebviewViewProvider
  const viewProviderDisposable = vscode.window.registerWebviewViewProvider(
    'javaDocSidebar',
    sidebarProvider,
    { webviewOptions: { retainContextWhenHidden: true } }
  );

  // 注册文件事件监听器
  const saveListener = createSaveListener(sidebarProvider);
  const editorChangeListener = createEditorChangeListener(sidebarProvider);
  const selectionListener = createSelectionListener(sidebarProvider);

  // 注册命令
  const refreshCommand = vscode.commands.registerCommand(
    'javaDocSidebar.refresh',
    () => { void sidebarProvider.refresh(); }
  );

  // 统一追踪所有 Disposable
  context.subscriptions.push(
    viewProviderDisposable,
    saveListener,
    editorChangeListener,
    selectionListener,
    refreshCommand,
    sidebarProvider
  );
}

function createSaveListener(provider: SidebarProvider): Disposable {
  return vscode.workspace.onDidSaveTextDocument((document) => {
    if (document.languageId === 'java') {
      void provider.refresh(document);
    }
  });
}

function createEditorChangeListener(provider: SidebarProvider): Disposable {
  return vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor?.document.languageId === 'java') {
      void provider.refresh(editor.document);
    } else {
      provider.clearView();
    }
  });
}

function createSelectionListener(provider: SidebarProvider): Disposable {
  return vscode.window.onDidChangeTextEditorSelection((event) => {
    if (event.textEditor.document.languageId === 'java') {
      provider.handleSelectionChange(event.selections[0]?.active.line ?? 0);
    }
  });
}

export function deactivate(): void {
  // 清理逻辑（如果需要）
}
```

### 3.2 SidebarProvider - Webview 管理

```typescript
// src/SidebarProvider.ts
import * as vscode from 'vscode';
import type { WebviewView, WebviewViewProvider, TextDocument, Disposable } from 'vscode';
import { JavaDocParser } from './parser/JavaDocParser.js';
import { debounce } from './utils/debounce.js';
import { binarySearchMethod } from './utils/binarySearch.js';
import type {
  ClassDoc,
  MethodDoc,
  MethodId,
  DownstreamMessage,
  UpstreamMessage,
  LineNumber
} from './types.js';
import { isUpstreamMessage, LineNumber as toLineNumber } from './types.js';

/**
 * Webview 侧边栏 Provider
 *
 * 职责：
 * 1. 管理 Webview 生命周期
 * 2. 协调解析器和 Webview 通信
 * 3. 处理双向联动逻辑
 */
export class SidebarProvider implements WebviewViewProvider, Disposable {
  private view: WebviewView | undefined;
  private currentMethods: readonly MethodDoc[] = [];
  private lastHighlightId: MethodId | null = null;
  private readonly parser: JavaDocParser;
  private readonly debouncedHighlight: (line: number) => void;

  constructor(private readonly extensionUri: vscode.Uri) {
    this.parser = new JavaDocParser();
    this.debouncedHighlight = debounce(
      (line: number) => { this.updateHighlight(toLineNumber(line)); },
      300
    );
  }

  /**
   * Webview 解析回调 - VS Code 调用
   */
  public resolveWebviewView(
    webviewView: WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // 监听上行消息
    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      this.handleUpstreamMessage(message);
    });

    // 初始加载
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor?.document.languageId === 'java') {
      void this.refresh(activeEditor.document);
    }
  }

  /**
   * 刷新侧边栏内容
   */
  public async refresh(document?: TextDocument): Promise<void> {
    const doc = document ?? vscode.window.activeTextEditor?.document;
    if (!doc || doc.languageId !== 'java') {
      this.clearView();
      return;
    }

    try {
      const classDoc = await this.parser.parse(doc);
      this.currentMethods = classDoc.methods;
      this.lastHighlightId = null;
      this.postMessage({ type: 'updateView', payload: classDoc });
    } catch (error) {
      console.error('[JavaDocSidebar] Parse error:', error);
      // 保持当前视图不变，显示错误提示
    }
  }

  /**
   * 清空视图
   */
  public clearView(): void {
    this.currentMethods = [];
    this.lastHighlightId = null;
    this.postMessage({ type: 'clearView' });
  }

  /**
   * 处理光标选择变化
   */
  public handleSelectionChange(line: number): void {
    this.debouncedHighlight(line);
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    // 清理需要的资源
  }

  private updateHighlight(cursorLine: LineNumber): void {
    const method = binarySearchMethod(this.currentMethods, cursorLine);
    const newId = method?.id ?? null;

    if (newId === this.lastHighlightId) {
      return; // 避免重复消息
    }

    this.lastHighlightId = newId;

    if (newId) {
      this.postMessage({ type: 'highlightMethod', payload: { id: newId } });
    }
  }

  private handleUpstreamMessage(message: unknown): void {
    if (!isUpstreamMessage(message)) {
      console.warn('[JavaDocSidebar] Invalid upstream message:', message);
      return;
    }

    switch (message.type) {
      case 'jumpToLine':
        this.jumpToLine(message.payload.line);
        break;
      case 'webviewReady':
        void this.refresh();
        break;
    }
  }

  private jumpToLine(line: LineNumber): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const position = new vscode.Position(line, 0);
    const range = new vscode.Range(position, position);

    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  }

  private postMessage(message: DownstreamMessage): void {
    void this.view?.webview.postMessage(message);
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'sidebar.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'sidebar.js')
    );
    const nonce = getNonce();

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy"
              content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri.toString()}" rel="stylesheet">
        <title>JavaDoc Sidebar</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri.toString()}"></script>
      </body>
      </html>
    `;
  }
}

function getNonce(): string {
  const array = new Uint32Array(4);
  crypto.getRandomValues(array);
  return Array.from(array, (n) => n.toString(36)).join('');
}
```

### 3.3 解析器 - 函数式管道设计

```typescript
// src/parser/JavaDocParser.ts
import * as vscode from 'vscode';
import type { TextDocument, DocumentSymbol } from 'vscode';
import { resolveSymbols } from './SymbolResolver.js';
import { parseTagTable } from './TagParser.js';
import type { ClassDoc, MethodDoc, TagTable, AccessModifier, MethodId, LineNumber, FilePath } from '../types.js';
import { MethodId, LineNumber, FilePath, EMPTY_TAG_TABLE } from '../types.js';

/**
 * 扁平化后的符号信息
 */
interface FlattenedSymbol {
  readonly symbol: DocumentSymbol;
  readonly belongsTo: string;
}

/**
 * JavaDoc 解析器
 *
 * 设计原则：
 * 1. 纯函数优先 - 解析逻辑无副作用
 * 2. 管道处理 - 数据流经多个转换阶段
 * 3. 错误边界 - 单个方法解析失败不影响整体
 */
export class JavaDocParser {
  private readonly javadocPattern = /\/\*\*[\s\S]*?\*\//;
  private readonly annotationPattern = /^\s*@\w+/;

  /**
   * 解析 Java 文档
   */
  public async parse(document: TextDocument): Promise<ClassDoc> {
    const symbols = await resolveSymbols(document.uri);
    const text = document.getText();

    // 提取类信息
    const classSymbol = this.findClassSymbol(symbols);
    const className = classSymbol?.name ?? this.extractClassNameFromText(text);
    const packageName = this.extractPackageName(text);
    const classComment = classSymbol
      ? this.extractComment(text, classSymbol.range.start.line)
      : '';

    // 扁平化并解析所有方法
    const flattenedSymbols = this.flattenSymbols(symbols, '');
    const methods = flattenedSymbols
      .filter((fs) => this.isMethodSymbol(fs.symbol))
      .map((fs) => this.parseMethod(text, fs))
      .filter((m): m is MethodDoc => m !== null)
      .sort((a, b) => a.startLine - b.startLine);

    return {
      className,
      classComment: this.cleanComment(classComment),
      packageName,
      filePath: FilePath(document.uri.fsPath),
      methods,
    };
  }

  private flattenSymbols(
    symbols: readonly DocumentSymbol[],
    parentName: string
  ): readonly FlattenedSymbol[] {
    const result: FlattenedSymbol[] = [];

    for (const symbol of symbols) {
      if (this.isClassLikeSymbol(symbol)) {
        const currentClass = parentName
          ? `${parentName}.${symbol.name}`
          : symbol.name;

        if (symbol.children.length > 0) {
          result.push(...this.flattenSymbols(symbol.children, currentClass));
        }
      } else if (this.isMethodSymbol(symbol)) {
        result.push({
          symbol,
          belongsTo: parentName || 'Unknown',
        });
      }
    }

    return result;
  }

  private parseMethod(text: string, flattened: FlattenedSymbol): MethodDoc | null {
    try {
      const { symbol, belongsTo } = flattened;
      const startLine = LineNumber(symbol.range.start.line);
      const endLine = LineNumber(symbol.range.end.line);

      const rawComment = this.extractComment(text, startLine);
      const hasComment = rawComment.length > 0;

      const { description, tags } = hasComment
        ? this.parseJavadoc(rawComment, symbol.detail ?? '')
        : { description: '', tags: EMPTY_TAG_TABLE };

      const accessModifier = this.extractAccessModifier(symbol.detail ?? '');
      const id = MethodId(`${symbol.name}_${startLine}`);

      return {
        id,
        name: symbol.name,
        signature: symbol.detail ?? symbol.name,
        startLine,
        endLine,
        hasComment,
        description,
        tags,
        belongsTo,
        accessModifier,
      };
    } catch (error) {
      console.error(`[JavaDocParser] Failed to parse method: ${flattened.symbol.name}`, error);
      return null;
    }
  }

  private extractComment(text: string, methodLine: number): string {
    const lines = text.split('\n');
    let searchLine = methodLine - 1;

    // 跳过空行和注解
    while (searchLine >= 0) {
      const line = lines[searchLine]?.trim() ?? '';

      if (line === '' || this.annotationPattern.test(line)) {
        searchLine--;
        continue;
      }

      if (line.endsWith('*/')) {
        break;
      }

      return ''; // 遇到非注释内容
    }

    if (searchLine < 0) return '';

    // 向上查找 /**
    const endLine = searchLine;
    while (searchLine >= 0) {
      const line = lines[searchLine] ?? '';
      if (line.includes('/**')) {
        const commentLines = lines.slice(searchLine, endLine + 1);
        return commentLines.join('\n');
      }
      searchLine--;
    }

    return '';
  }

  private parseJavadoc(
    rawComment: string,
    signature: string
  ): { description: string; tags: TagTable } {
    const cleaned = this.cleanComment(rawComment);
    const tagIndex = cleaned.search(/@\w+/);

    const description = tagIndex === -1
      ? cleaned
      : cleaned.slice(0, tagIndex).trim();

    const rawTags = tagIndex === -1
      ? ''
      : cleaned.slice(tagIndex);

    const tags = parseTagTable(rawTags, signature);

    return { description, tags };
  }

  private cleanComment(raw: string): string {
    return raw
      .replace(/\/\*\*|\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim();
  }

  private extractAccessModifier(detail: string): AccessModifier {
    if (detail.startsWith('public')) return 'public';
    if (detail.startsWith('protected')) return 'protected';
    if (detail.startsWith('private')) return 'private';
    return 'default';
  }

  private findClassSymbol(symbols: readonly DocumentSymbol[]): DocumentSymbol | undefined {
    return symbols.find((s) => this.isClassLikeSymbol(s));
  }

  private isClassLikeSymbol(symbol: DocumentSymbol): boolean {
    return symbol.kind === vscode.SymbolKind.Class ||
           symbol.kind === vscode.SymbolKind.Interface;
  }

  private isMethodSymbol(symbol: DocumentSymbol): boolean {
    return symbol.kind === vscode.SymbolKind.Method ||
           symbol.kind === vscode.SymbolKind.Constructor;
  }

  private extractClassNameFromText(text: string): string {
    const match = /(?:class|interface|enum)\s+(\w+)/.exec(text);
    return match?.[1] ?? 'Unknown';
  }

  private extractPackageName(text: string): string {
    const match = /package\s+([\w.]+);/.exec(text);
    return match?.[1] ?? '';
  }
}
```

### 3.4 标签解析器

```typescript
// src/parser/TagParser.ts
import type { TagTable, ParamTag, ReturnTag, ThrowsTag } from '../types.js';
import { EMPTY_TAG_TABLE } from '../types.js';

/**
 * 参数签名信息
 */
interface ParamSignature {
  readonly name: string;
  readonly type: string;
}

/**
 * 解析 Javadoc 标签表格
 *
 * @param rawTags - 原始标签文本（从第一个 @tag 开始）
 * @param signature - 方法签名（用于提取类型信息）
 * @returns 结构化的标签表格
 */
export function parseTagTable(rawTags: string, signature: string): TagTable {
  if (!rawTags.trim()) {
    return EMPTY_TAG_TABLE;
  }

  const paramTypes = parseSignatureParams(signature);
  const returnType = parseReturnType(signature);

  const params: ParamTag[] = [];
  const throws: ThrowsTag[] = [];
  const see: string[] = [];
  let returns: ReturnTag | null = null;
  let since: string | null = null;
  let author: string | null = null;
  let deprecated: string | null = null;

  // 按 @tag 分割，保留标签名
  const tagPattern = /@(param|return|returns|throws|exception|since|author|deprecated|see)\s+/g;
  const segments = rawTags.split(tagPattern);

  // segments: ['', 'param', 'id 描述', 'return', '描述', ...]
  for (let i = 1; i < segments.length; i += 2) {
    const tagName = segments[i];
    const content = segments[i + 1]?.trim() ?? '';

    switch (tagName) {
      case 'param': {
        const param = parseParamTag(content, paramTypes);
        if (param) params.push(param);
        break;
      }
      case 'return':
      case 'returns': {
        if (returnType !== 'void') {
          returns = { type: returnType, description: content };
        }
        break;
      }
      case 'throws':
      case 'exception': {
        const throwsTag = parseThrowsTag(content);
        if (throwsTag) throws.push(throwsTag);
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

function parseParamTag(
  content: string,
  paramTypes: Map<string, string>
): ParamTag | null {
  const match = /^(\w+)\s*(.*)$/s.exec(content);
  if (!match) return null;

  const name = match[1] ?? '';
  const description = match[2]?.trim() ?? '';
  const type = paramTypes.get(name) ?? 'unknown';

  return { name, type, description };
}

function parseThrowsTag(content: string): ThrowsTag | null {
  const match = /^([\w.]+)\s*(.*)$/s.exec(content);
  if (!match) return null;

  return {
    type: match[1] ?? '',
    description: match[2]?.trim() ?? '',
  };
}

/**
 * 从方法签名解析参数类型映射
 */
function parseSignatureParams(signature: string): Map<string, string> {
  const map = new Map<string, string>();

  // 匹配参数列表部分
  const paramsMatch = /\(([^)]*)\)/.exec(signature);
  if (!paramsMatch?.[1]) return map;

  const paramsStr = paramsMatch[1];

  // 处理泛型嵌套
  const params = splitParams(paramsStr);

  for (const param of params) {
    const trimmed = param.trim();
    if (!trimmed) continue;

    // 最后一个空格分隔类型和名称
    const lastSpace = trimmed.lastIndexOf(' ');
    if (lastSpace === -1) continue;

    const type = trimmed.slice(0, lastSpace).trim();
    const name = trimmed.slice(lastSpace + 1).trim();

    if (name && type) {
      map.set(name, type);
    }
  }

  return map;
}

/**
 * 分割参数列表（处理泛型中的逗号）
 */
function splitParams(paramsStr: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of paramsStr) {
    if (char === '<') {
      depth++;
      current += char;
    } else if (char === '>') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    result.push(current);
  }

  return result;
}

/**
 * 从方法签名解析返回类型
 */
function parseReturnType(signature: string): string {
  // 移除泛型声明 <T, U>
  const withoutGenericDecl = signature.replace(/<[^>]+>\s*(?=\w)/, '');

  // 匹配返回类型（方法名之前的类型）
  const match = /(?:public|private|protected|static|final|abstract|synchronized|\s)+\s*([\w<>\[\],\s?]+?)\s+\w+\s*\(/.exec(withoutGenericDecl);

  return match?.[1]?.trim() ?? 'void';
}
```

### 3.5 工具函数

```typescript
// src/utils/debounce.ts

/**
 * 防抖函数 - 泛型版本
 *
 * @param fn - 要防抖的函数
 * @param delay - 延迟毫秒数
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}
```

```typescript
// src/utils/binarySearch.ts
import type { MethodDoc, LineNumber } from '../types.js';

/**
 * 二分查找当前光标所在的方法
 *
 * @param methods - 按 startLine 升序排列的方法列表
 * @param cursorLine - 当前光标行号
 * @returns 匹配的方法，或 null
 */
export function binarySearchMethod(
  methods: readonly MethodDoc[],
  cursorLine: LineNumber
): MethodDoc | null {
  if (methods.length === 0) {
    return null;
  }

  let lo = 0;
  let hi = methods.length - 1;
  let result: MethodDoc | null = null;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const method = methods[mid];

    if (method === undefined) {
      break;
    }

    if (method.startLine <= cursorLine) {
      result = method; // 候选结果
      lo = mid + 1;    // 继续向右搜索更靠后的方法
    } else {
      hi = mid - 1;    // 目标在左侧
    }
  }

  // 验证光标是否真的在方法范围内
  if (result !== null && result.endLine >= cursorLine) {
    return result;
  }

  return null;
}
```

---

## 4. 错误处理模式

### 4.1 使用 Result 类型替代异常

```typescript
// src/utils/result.ts

/**
 * Result 类型 - 函数式错误处理
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const Result = {
  ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
  },

  err<E>(error: E): Result<never, E> {
    return { ok: false, error };
  },

  map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    return result.ok ? Result.ok(fn(result.value)) : result;
  },

  flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
    return result.ok ? fn(result.value) : result;
  },

  unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    return result.ok ? result.value : defaultValue;
  },
};
```

### 4.2 解析错误类型定义

```typescript
// src/types.ts

/**
 * 解析错误类型
 */
export const ParseErrorCode = {
  SYMBOL_RESOLUTION_FAILED: 'SYMBOL_RESOLUTION_FAILED',
  INVALID_JAVADOC_FORMAT: 'INVALID_JAVADOC_FORMAT',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
} as const;

export type ParseErrorCode = (typeof ParseErrorCode)[keyof typeof ParseErrorCode];

export interface ParseError {
  readonly code: ParseErrorCode;
  readonly message: string;
  readonly line?: LineNumber;
}
```

---

## 5. 测试策略

### 5.1 单元测试示例

```typescript
// test/parser/TagParser.test.ts
import { describe, it, expect } from 'vitest';
import { parseTagTable } from '../../src/parser/TagParser.js';

describe('parseTagTable', () => {
  it('should parse @param tags with type inference', () => {
    const rawTags = '@param id 用户的唯一标识\n@param force 是否强制执行';
    const signature = 'public void process(Long id, boolean force)';

    const result = parseTagTable(rawTags, signature);

    expect(result.params).toHaveLength(2);
    expect(result.params[0]).toEqual({
      name: 'id',
      type: 'Long',
      description: '用户的唯一标识',
    });
    expect(result.params[1]).toEqual({
      name: 'force',
      type: 'boolean',
      description: '是否强制执行',
    });
  });

  it('should handle generic return types', () => {
    const rawTags = '@return 用户列表';
    const signature = 'public List<User> findAll()';

    const result = parseTagTable(rawTags, signature);

    expect(result.returns).toEqual({
      type: 'List<User>',
      description: '用户列表',
    });
  });

  it('should return null for void return type', () => {
    const rawTags = '@return nothing';
    const signature = 'public void doSomething()';

    const result = parseTagTable(rawTags, signature);

    expect(result.returns).toBeNull();
  });

  it('should parse nested generic parameters', () => {
    const rawTags = '@param mapper 转换函数';
    const signature = 'public void apply(Function<Map<String, List<User>>, Result> mapper)';

    const result = parseTagTable(rawTags, signature);

    expect(result.params[0]?.type).toBe('Function<Map<String, List<User>>, Result>');
  });
});
```

### 5.2 集成测试示例

```typescript
// test/integration/SidebarProvider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { SidebarProvider } from '../../src/SidebarProvider.js';

// Mock VS Code API
vi.mock('vscode', () => ({
  Uri: {
    joinPath: vi.fn((base, ...paths) => ({ fsPath: paths.join('/') })),
  },
  window: {
    activeTextEditor: undefined,
  },
  Position: class {
    constructor(public line: number, public character: number) {}
  },
  Range: class {
    constructor(public start: vscode.Position, public end: vscode.Position) {}
  },
  Selection: class {
    constructor(public anchor: vscode.Position, public active: vscode.Position) {}
  },
  SymbolKind: {
    Class: 5,
    Method: 6,
    Constructor: 9,
  },
}));

describe('SidebarProvider', () => {
  let provider: SidebarProvider;
  let mockExtensionUri: vscode.Uri;

  beforeEach(() => {
    mockExtensionUri = { fsPath: '/test/extension' } as vscode.Uri;
    provider = new SidebarProvider(mockExtensionUri);
  });

  it('should clear view when document is not Java', async () => {
    const mockDocument = {
      languageId: 'typescript',
      uri: { fsPath: '/test/file.ts' },
    } as vscode.TextDocument;

    await provider.refresh(mockDocument);

    // Verify clearView behavior
    expect(provider['currentMethods']).toEqual([]);
  });
});
```

---

## 6. 性能优化检查清单

### 6.1 必须遵守的性能规则

| 规则 | 说明 | 检查点 |
|------|------|--------|
| **防抖必选** | 所有高频事件必须防抖 | `onDidChangeTextEditorSelection` |
| **去重必选** | 相同消息不重复发送 | `lastHighlightId` 比对 |
| **缓存优先** | 相同文件版本使用缓存 | `document.version` 检查 |
| **懒加载** | 非必要不初始化 | `resolveWebviewView` 时机 |
| **批量更新** | 避免多次 DOM 操作 | `innerHTML` 一次性替换 |

### 6.2 类型检查命令

```bash
# 严格类型检查
npx tsc --noEmit --strict

# 增量编译检查
npx tsc --noEmit --incremental

# 查找未使用的导出
npx ts-prune
```

---

## 7. 代码风格约定

### 7.1 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 接口 | PascalCase，无 I 前缀 | `MethodDoc`, `TagTable` |
| 类型别名 | PascalCase | `AccessModifier`, `LineNumber` |
| 枚举 | PascalCase | `ParseErrorCode` |
| 枚举成员 | UPPER_SNAKE_CASE | `SYMBOL_RESOLUTION_FAILED` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_CONFIG`, `EMPTY_TAG_TABLE` |
| 函数 | camelCase | `parseTagTable`, `binarySearchMethod` |
| 类 | PascalCase | `SidebarProvider`, `JavaDocParser` |
| 私有成员 | 无前缀，使用 `private` | `private view: WebviewView` |

### 7.2 导入顺序

```typescript
// 1. Node.js 内置模块
import * as crypto from 'node:crypto';

// 2. 第三方依赖
import * as vscode from 'vscode';

// 3. 类型导入（使用 type 关键字）
import type { TextDocument, DocumentSymbol } from 'vscode';

// 4. 本地模块（相对路径）
import { JavaDocParser } from './parser/JavaDocParser.js';
import type { MethodDoc, ClassDoc } from './types.js';
```

### 7.3 注释规范

```typescript
/**
 * 函数级 JSDoc - 仅在公共 API 和复杂逻辑处使用
 *
 * @param document - 要解析的文档
 * @returns 解析后的类文档结构
 * @throws 当 Symbol 解析失败时抛出
 */
public async parse(document: TextDocument): Promise<ClassDoc> {
  // 行内注释：解释"为什么"，而非"是什么"
  // 使用缓存避免重复解析相同版本的文档
  const cached = this.cache.get(document.uri.toString());
  if (cached?.version === document.version) {
    return cached.doc;
  }

  // ...
}
```

---

## 8. 安全检查清单

### 8.1 Webview 安全

- [ ] 配置严格的 Content-Security-Policy
- [ ] 使用 nonce 限制脚本执行
- [ ] 使用 DOMPurify 清洗 HTML 内容
- [ ] 限制 `localResourceRoots`
- [ ] 验证所有上行消息的类型

### 8.2 类型安全

- [ ] 启用 `strict: true`
- [ ] 启用 `noUncheckedIndexedAccess`
- [ ] 使用类型守卫验证外部数据
- [ ] 避免使用 `any` 类型
- [ ] 使用 `readonly` 修饰不可变数据

---

> **文档版本**: v1.0
> **最后更新**: 2026-02-04
> **适用范围**: VS Code Extension + TypeScript 5.5+

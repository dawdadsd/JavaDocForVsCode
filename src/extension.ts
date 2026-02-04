/**
 * extension.ts - 扩展入口文件
 *
 * 【VS Code 扩展的生命周期】
 * 1. 用户触发激活事件（如打开 Java 文件）
 * 2. VS Code 调用 activate() 函数
 * 3. 扩展注册各种功能（命令、视图、事件监听等）
 * 4. 用户使用扩展...
 * 5. VS Code 关闭或扩展被禁用时，调用 deactivate()
 *
 * 【本模块职责】
 * 只做三件事：
 * 1. 注册 WebviewViewProvider（侧边栏）
 * 2. 注册事件监听器（文件保存、光标移动等）
 * 3. 注册命令（刷新按钮等）
 *
 * 不做任何业务逻辑！业务逻辑在 SidebarProvider 中
 */

import * as vscode from 'vscode';
import type { Disposable } from 'vscode';
import { SidebarProvider } from './SidebarProvider.js';

/**
 * 扩展激活函数
 *
 * @param context - 扩展上下文，用于管理资源生命周期
 *
 * 【ExtensionContext 的作用】
 * 1. subscriptions：Disposable 数组，扩展卸载时自动清理
 * 2. extensionUri：扩展根目录的 URI
 * 3. globalState/workspaceState：持久化存储
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('[JavaDocSidebar] Extension is now active!');

  // ========== 1. 创建 SidebarProvider ==========
  // 创建两个实例：一个用于左侧边栏，一个用于底部面板
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  const panelProvider = new SidebarProvider(context.extensionUri);

  // ========== 2. 注册 WebviewViewProvider ==========
  // 左侧活动栏视图
  const viewProviderDisposable = vscode.window.registerWebviewViewProvider(
    'javaDocSidebar',
    sidebarProvider,
    {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    }
  );

  // 底部面板视图
  const panelProviderDisposable = vscode.window.registerWebviewViewProvider(
    'javaDocSidebarPanel',
    panelProvider,
    {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    }
  );

  // ========== 3. 注册事件监听器 ==========
  // 需要同时更新两个视图

  // 3.1 文件保存时刷新
  const saveListener = createSaveListener(sidebarProvider, panelProvider);

  // 3.2 切换编辑器时刷新
  const editorChangeListener = createEditorChangeListener(sidebarProvider, panelProvider);

  // 3.3 光标移动时高亮（反向联动）
  const selectionListener = createSelectionListener(sidebarProvider, panelProvider);

  // ========== 4. 注册命令 ==========

  // 手动刷新命令
  const refreshCommand = vscode.commands.registerCommand(
    'javaDocSidebar.refresh',
    () => {
      void sidebarProvider.refresh();
      void panelProvider.refresh();
    }
  );

  // ========== 5. 注册到 subscriptions ==========
  context.subscriptions.push(
    viewProviderDisposable,
    panelProviderDisposable,
    saveListener,
    editorChangeListener,
    selectionListener,
    refreshCommand,
    sidebarProvider,
    panelProvider
  );
}

/**
 * 创建文件保存监听器
 */
function createSaveListener(provider: SidebarProvider, panelProvider: SidebarProvider): Disposable {
  return vscode.workspace.onDidSaveTextDocument((document) => {
    if (document.languageId === 'java') {
      void provider.refresh(document);
      void panelProvider.refresh(document);
    }
  });
}

/**
 * 创建编辑器切换监听器
 */
function createEditorChangeListener(provider: SidebarProvider, panelProvider: SidebarProvider): Disposable {
  return vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor?.document.languageId === 'java') {
      void provider.refresh(editor.document);
      void panelProvider.refresh(editor.document);
    } else {
      provider.clearView();
      panelProvider.clearView();
    }
  });
}

/**
 * 创建光标选择监听器（反向联动）
 */
function createSelectionListener(provider: SidebarProvider, panelProvider: SidebarProvider): Disposable {
  return vscode.window.onDidChangeTextEditorSelection((event) => {
    if (event.textEditor.document.languageId === 'java') {
      const line = event.selections[0]?.active.line ?? 0;
      provider.handleSelectionChange(line);
      panelProvider.handleSelectionChange(line);
    }
  });
}

/**
 * 扩展停用函数
 *
 * 【何时被调用？】
 * - VS Code 关闭
 * - 用户禁用扩展
 * - 扩展更新时
 *
 * 【我们需要做什么？】
 * 通常不需要做任何事，因为：
 * 1. subscriptions 中的 Disposable 会自动清理
 * 2. VS Code 会自动清理事件监听器
 *
 * 保留空函数是为了明确表示"我们知道有这个生命周期"
 */
export function deactivate(): void {
  console.log('[JavaDocSidebar] Extension is now deactivated.');
}

/**
 * sidebar.js - Webview 前端交互逻辑
 */

(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  const root = document.getElementById('root');

  // ========== 状态 ==========
  let currentClassDoc = null;
  const collapsedMethods = new Set();
  let isCompactMode = true;  // 默认使用简洁模式

  // ========== 初始化 ==========
  function init() {
    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'webviewReady' });
  }

  // ========== 消息处理 ==========
  function handleMessage(event) {
    const message = event.data;

    switch (message.type) {
      case 'updateView':
        currentClassDoc = message.payload;
        renderClassDoc(message.payload);
        break;

      case 'highlightMethod':
        highlightMethod(message.payload.id);
        break;

      case 'clearView':
        currentClassDoc = null;
        renderEmptyState('打开 Java 文件以查看文档');
        break;
    }
  }

  // ========== 渲染函数 ==========

  function renderEmptyState(message) {
    root.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${getEmptyIcon()}</div>
        <div class="empty-state-text">${escapeHtml(message)}</div>
      </div>
    `;
  }

  function renderClassDoc(classDoc) {
    if (!classDoc || !classDoc.methods || classDoc.methods.length === 0) {
      renderEmptyState('该类没有方法定义');
      return;
    }

    let html = '';

    // 头部：类信息 + 切换按钮
    html += `
      <div class="header">
        <div class="header-top">
          <div class="class-info">
            <div class="class-name">${escapeHtml(classDoc.className)}</div>
            ${classDoc.packageName ? `<div class="package-name">${escapeHtml(classDoc.packageName)}</div>` : ''}
          </div>
          <button class="view-toggle" id="viewToggle" title="${isCompactMode ? '切换到详细视图' : '切换到简洁视图'}">
            ${isCompactMode ? getListIcon() : getDetailIcon()}
          </button>
        </div>
        ${renderAuthorInfo(classDoc)}
        ${classDoc.classComment ? `<div class="class-comment">${escapeHtml(classDoc.classComment)}</div>` : ''}
      </div>
    `;

    // 方法列表
    html += `<div class="method-list ${isCompactMode ? 'compact-mode' : 'detail-mode'}">`;

    let lastBelongsTo = '';

    for (const method of classDoc.methods) {
      if (method.belongsTo !== lastBelongsTo && method.belongsTo !== classDoc.className) {
        html += `
          <div class="class-separator">
            <span class="class-separator-text">${escapeHtml(method.belongsTo)}</span>
          </div>
        `;
      }
      lastBelongsTo = method.belongsTo;

      html += isCompactMode ? renderMethodCompact(method) : renderMethodDetail(method);
    }

    html += '</div>';

    root.innerHTML = html;
    bindEvents();
  }

  /**
   * 简洁模式：显示方法名、返回类型、参数列表
   */
  function renderMethodCompact(method) {
    const noCommentClass = method.hasComment ? '' : 'no-comment';
    const firstLine = getFirstLine(method.description);
    const returnType = method.tags?.returns?.type || 'void';

    // 格式化参数列表
    const params = method.tags?.params || [];
    const paramsStr = params.length > 0
      ? params.map(p => `${p.type} ${p.name}`).join(', ')
      : '无参数';

    return `
      <div class="method-item compact ${noCommentClass}" data-id="${escapeHtml(method.id)}" data-line="${method.startLine}">
        <div class="method-compact-header">
          <span class="method-name">${escapeHtml(method.name)}</span>
          <span class="method-access">${escapeHtml(method.accessModifier)}</span>
        </div>
        <div class="method-compact-meta">
          <div class="method-meta-row">
            <span class="meta-label">返回类型:</span>
            <span class="meta-value type-value">${escapeHtml(returnType)}</span>
          </div>
          <div class="method-meta-row">
            <span class="meta-label">参数:</span>
            <span class="meta-value params-value">${escapeHtml(paramsStr)}</span>
          </div>
        </div>
        ${firstLine
          ? `<div class="method-desc-preview">${escapeHtml(firstLine)}</div>`
          : (method.hasComment ? '' : '<div class="method-desc-preview no-doc">无注释</div>')}
      </div>
    `;
  }

  /**
   * 详细模式：显示完整信息
   */
  function renderMethodDetail(method) {
    const isCollapsed = collapsedMethods.has(method.id);
    const noCommentClass = method.hasComment ? '' : 'no-comment';
    const collapsedClass = isCollapsed ? 'collapsed' : '';
    const returnType = method.tags?.returns?.type || 'void';

    // 格式化参数列表
    const params = method.tags?.params || [];
    const paramsStr = params.length > 0
      ? params.map(p => `${p.type} ${p.name}`).join(', ')
      : '无参数';

    let contentHtml = '';

    if (method.hasComment) {
      if (method.description) {
        contentHtml += `<div class="method-description">${escapeHtml(method.description)}</div>`;
      }

      if (method.tags.deprecated) {
        contentHtml += `
          <div class="deprecated-tag">
            <span class="other-tag-name">@deprecated</span>
            ${escapeHtml(method.tags.deprecated)}
          </div>
        `;
      }

      if (method.tags.params && method.tags.params.length > 0) {
        contentHtml += renderParamsTable(method.tags.params);
      }

      if (method.tags.returns) {
        contentHtml += renderReturnsTable(method.tags.returns);
      }

      if (method.tags.throws && method.tags.throws.length > 0) {
        contentHtml += renderThrowsTable(method.tags.throws);
      }

      contentHtml += renderOtherTags(method.tags);
    } else {
      contentHtml += '<div class="no-comment-hint">无注释</div>';
    }

    return `
      <div class="method-item detail ${noCommentClass} ${collapsedClass}" data-id="${escapeHtml(method.id)}">
        <div class="method-header" data-line="${method.startLine}">
          <span class="collapse-icon">${getCollapseIcon()}</span>
          <div class="method-info">
            <div class="method-name-row">
              <span class="method-name">${escapeHtml(method.name)}</span>
              <span class="access-badge">${escapeHtml(method.accessModifier)}</span>
            </div>
            <div class="method-detail-meta">
              <span class="detail-meta-item">
                <span class="detail-label">返回:</span>
                <span class="detail-type">${escapeHtml(returnType)}</span>
              </span>
              <span class="detail-meta-item">
                <span class="detail-label">参数:</span>
                <span class="detail-params">${escapeHtml(paramsStr)}</span>
              </span>
            </div>
          </div>
        </div>
        <div class="method-content">
          ${contentHtml}
        </div>
      </div>
    `;
  }

  function renderParamsTable(params) {
    let rows = '';
    for (const param of params) {
      rows += `
        <tr>
          <td class="name-cell">${escapeHtml(param.name)}</td>
          <td class="type-cell">${escapeHtml(param.type)}</td>
          <td>${escapeHtml(param.description) || '-'}</td>
        </tr>
      `;
    }

    return `
      <div class="tag-section">
        <div class="tag-title">参数 Parameters</div>
        <table class="tag-table">
          <thead>
            <tr>
              <th style="width: 20%">名称</th>
              <th style="width: 25%">类型</th>
              <th style="width: 55%">描述</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderReturnsTable(returns) {
    return `
      <div class="tag-section">
        <div class="tag-title">返回值 Returns</div>
        <table class="tag-table">
          <thead>
            <tr>
              <th style="width: 30%">类型</th>
              <th style="width: 70%">描述</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="type-cell">${escapeHtml(returns.type)}</td>
              <td>${escapeHtml(returns.description) || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  function renderThrowsTable(throws) {
    let rows = '';
    for (const t of throws) {
      rows += `
        <tr>
          <td class="type-cell">${escapeHtml(t.type)}</td>
          <td>${escapeHtml(t.description) || '-'}</td>
        </tr>
      `;
    }

    return `
      <div class="tag-section">
        <div class="tag-title">异常 Throws</div>
        <table class="tag-table">
          <thead>
            <tr>
              <th style="width: 40%">异常类型</th>
              <th style="width: 60%">触发条件</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderOtherTags(tags) {
    let html = '';

    if (tags.since || tags.author || (tags.see && tags.see.length > 0)) {
      html += '<div class="other-tags">';

      if (tags.since) {
        html += `<div class="other-tag"><span class="other-tag-name">@since</span>${escapeHtml(tags.since)}</div>`;
      }

      if (tags.author) {
        html += `<div class="other-tag"><span class="other-tag-name">@author</span>${escapeHtml(tags.author)}</div>`;
      }

      if (tags.see && tags.see.length > 0) {
        for (const see of tags.see) {
          html += `<div class="other-tag"><span class="other-tag-name">@see</span>${escapeHtml(see)}</div>`;
        }
      }

      html += '</div>';
    }

    return html;
  }

  // ========== 交互处理 ==========

  function bindEvents() {
    root.addEventListener('click', handleClick);
  }

  function handleClick(event) {
    const target = event.target;

    // 切换视图按钮
    if (target.closest('#viewToggle')) {
      isCompactMode = !isCompactMode;
      if (currentClassDoc) {
        renderClassDoc(currentClassDoc);
      }
      return;
    }

    // 简洁模式：点击整个条目跳转
    const compactItem = target.closest('.method-item.compact');
    if (compactItem) {
      const line = parseInt(compactItem.dataset.line, 10);
      if (!isNaN(line)) {
        vscode.postMessage({ type: 'jumpToLine', payload: { line } });
      }
      return;
    }

    // 详细模式：点击头部
    const methodHeader = target.closest('.method-header');
    if (methodHeader) {
      const methodItem = methodHeader.closest('.method-item');
      const methodId = methodItem?.dataset.id;
      const line = parseInt(methodHeader.dataset.line, 10);

      const collapseIcon = target.closest('.collapse-icon');
      if (collapseIcon && methodId) {
        toggleCollapse(methodId);
      } else if (!isNaN(line)) {
        vscode.postMessage({ type: 'jumpToLine', payload: { line } });
      }
    }
  }

  function toggleCollapse(methodId) {
    const methodItem = document.querySelector(`.method-item[data-id="${methodId}"]`);
    if (!methodItem) return;

    if (collapsedMethods.has(methodId)) {
      collapsedMethods.delete(methodId);
      methodItem.classList.remove('collapsed');
    } else {
      collapsedMethods.add(methodId);
      methodItem.classList.add('collapsed');
    }
  }

  function highlightMethod(methodId) {
    const allItems = document.querySelectorAll('.method-item');
    allItems.forEach(item => item.classList.remove('active'));

    const targetItem = document.querySelector(`.method-item[data-id="${methodId}"]`);
    if (targetItem) {
      targetItem.classList.add('active');
      targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ========== 工具函数 ==========

  function getFirstLine(text) {
    if (!text) return '';
    const firstLine = text.split('\n')[0].trim();
    // 限制长度
    return firstLine.length > 60 ? firstLine.slice(0, 60) + '...' : firstLine;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // SVG 图标 - 列表视图（简洁模式）
  function getListIcon() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>`;
  }

  // SVG 图标 - 详细视图（卡片模式）
  function getDetailIcon() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"></rect>
      <rect x="14" y="3" width="7" height="7" rx="1"></rect>
      <rect x="3" y="14" width="7" height="7" rx="1"></rect>
      <rect x="14" y="14" width="7" height="7" rx="1"></rect>
    </svg>`;
  }

  // SVG 图标 - 折叠箭头
  function getCollapseIcon() {
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>`;
  }

  // SVG 图标 - 空状态文档图标
  function getEmptyIcon() {
    return `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>`;
  }

  // SVG 图标 - 用户图标
  function getUserIcon() {
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>`;
  }

  // SVG 图标 - Git 图标
  function getGitIcon() {
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <line x1="3" y1="12" x2="9" y2="12"></line>
      <line x1="15" y1="12" x2="21" y2="12"></line>
    </svg>`;
  }

  // SVG 图标 - 日历图标
  function getCalendarIcon() {
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>`;
  }

  /**
   * 渲染作者信息区域
   */
  function renderAuthorInfo(classDoc) {
    const hasJavadocAuthor = classDoc.javadocAuthor;
    const hasGitInfo = classDoc.gitInfo;

    if (!hasJavadocAuthor && !hasGitInfo) {
      return '';
    }

    let html = '<div class="author-info">';

    // 优先显示 Javadoc @author
    if (hasJavadocAuthor) {
      html += `
        <div class="author-item" title="来自 @author 标签">
          ${getUserIcon()}
          <span class="author-label">作者:</span>
          <span class="author-value">${escapeHtml(classDoc.javadocAuthor)}</span>
        </div>
      `;
    }

    // 显示 Javadoc @since
    if (classDoc.javadocSince) {
      html += `
        <div class="author-item" title="来自 @since 标签">
          ${getCalendarIcon()}
          <span class="author-label">创建:</span>
          <span class="author-value">${escapeHtml(classDoc.javadocSince)}</span>
        </div>
      `;
    }

    // 显示 Git 信息
    if (hasGitInfo) {
      // 如果没有 @author，显示 Git 原始作者
      if (!hasJavadocAuthor && classDoc.gitInfo.author) {
        html += `
          <div class="author-item" title="来自 Git 提交历史">
            ${getGitIcon()}
            <span class="author-label">作者:</span>
            <span class="author-value">${escapeHtml(classDoc.gitInfo.author)}</span>
          </div>
        `;
      }

      // 显示最后修改者
      if (classDoc.gitInfo.lastModifier) {
        html += `
          <div class="author-item" title="来自 Git Blame">
            ${getGitIcon()}
            <span class="author-label">最后修改:</span>
            <span class="author-value">${escapeHtml(classDoc.gitInfo.lastModifier)}</span>
            ${classDoc.gitInfo.lastModifyDate ? `<span class="author-date">${escapeHtml(classDoc.gitInfo.lastModifyDate)}</span>` : ''}
          </div>
        `;
      }
    }

    html += '</div>';
    return html;
  }

  // ========== 启动 ==========
  init();
})();

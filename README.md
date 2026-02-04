# JavaDoc Sidebar

在 VS Code 侧边栏实时展示 Java 文件的 Javadoc 文档，支持双向联动导航。

## 功能特性

- **实时文档展示**：打开 Java 文件时自动解析并展示所有方法的 Javadoc 文档
- **双向联动**：
  - 点击侧边栏方法 → 跳转到代码对应位置
  - 移动代码光标 → 侧边栏自动高亮当前方法
- **两种视图模式**：
  - 简洁模式：快速浏览方法列表
  - 详细模式：展示完整文档信息
- **结构化展示**：
  - 返回类型和参数类型高亮显示
  - @param、@return、@throws 等标签以表格形式展示

## 使用方法

1. 打开任意 Java 文件
2. 点击左侧活动栏的 JavaDoc 图标
3. 在侧边栏查看方法文档
4. 点击方法名跳转到代码位置

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `javaDocSidebar.enableAutoHighlight` | boolean | true | 是否启用光标移动时的反向联动高亮 |
| `javaDocSidebar.debounceDelay` | number | 300 | 反向联动的防抖延迟（毫秒） |
| `javaDocSidebar.maxMethods` | number | 200 | 侧边栏最多展示的方法数量 |

## 系统要求

- VS Code 1.95.0 或更高版本
- 需要安装 Java 语言支持扩展（用于 Symbol 解析）

## 许可证

MIT

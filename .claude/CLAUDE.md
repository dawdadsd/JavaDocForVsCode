# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

AI习惯分析系统是一个全栈应用，帮助用户通过AI分析和改善个人习惯。

### 技术架构
- **后端**: Spring Boot 3.3.0 + Java 21 + MySQL + Redis
- **前端**: React 18 + TypeScript + Vite + Tailwind CSS + Radix UI
- **AI服务**: Spring AI + OpenAI GPT-4o (通过中转站)
- **通信**: WebSocket + RESTful API

### 目录结构
```
AI 习惯分析/
├── habi-front/              # React 18 前端应用
│   ├── src/
│   │   ├── components/      # 可复用组件
│   │   ├── services/        # API服务
│   │   ├── types/           # TypeScript类型定义
│   │   ├── utils/           # 工具函数
│   │   └── styles/          # 样式文件
├── chat_service/            # Spring Boot 后端服务
│   ├── src/main/java/com/example/chatservice/
│   │   ├── controller/      # REST控制器
│   │   ├── service/         # 业务逻辑服务
│   │   ├── repository/      # 数据访问层
│   │   ├── entity/          # JPA实体类
│   │   ├── dto/             # 数据传输对象
│   │   └── config/          # 配置类
└── 开发文档/                # 项目文档
```

## 常用命令

### 前端开发 (habi-front/)
```bash
# 安装依赖
npm install

# 开发模式启动
npm run dev

# 代码检查和修复
npm run lint
npm run format

# 构建生产版本
npm run build

# TypeScript类型检查
npx tsc --noEmit
```

### 后端开发 (chat_service/)
```bash
# Maven构建和启动
./mvnw spring-boot:run

# 测试
./mvnw test

# 打包
./mvnw clean package

# 使用JAR启动
java -jar target/habit-ai-service-1.0.0.jar
```

### 数据库相关
```bash
# MySQL连接
mysql -u root -p -h localhost -P 3306 habit_ai

# Redis连接
redis-cli

# 应用SQL脚本
mysql -u root -p habit_ai < fix_column_length.sql
```

## 关键架构模式

### 前端架构
- **状态管理**: React Hooks + Context API
- **API层**: Axios + 错误处理 + 数据适配器
- **UI组件**: Radix UI + 自定义组件系统
- **组件模式**: React Functional Components + Hooks
- **类型安全**: TypeScript严格模式 + 接口定义

### 后端架构
- **分层架构**: Controller → Service → Repository → Entity
- **依赖注入**: Spring IoC容器
- **数据访问**: Spring Data JPA + MySQL
- **缓存**: Redis + Spring Cache
- **安全**: JWT + Spring Security
- **API文档**: SpringDoc OpenAPI 3

### AI服务集成
```yaml
# 关键配置
spring:
  ai:
    openai:
      api-key: ${OPENAI_API_KEY}
      base-url: ${OPENAI_BASE_URL:https://fast.yourapi.cn}  # 中转站代理
      chat:
        model: gpt-4o-mini
        timeout: 60s
      retry:
        max-attempts: 3
```

### 数据库设计
主要实体:
- `User` - 用户信息
- `Habit` - 习惯定义
- `HabitEntry` - 习惯记录
- `SmartPlan` - 智能计划
- `PlanTask` - 计划任务
- `ChatSession` - 对话会话

## 开发规范

### 前端规范
- 组件命名: PascalCase (UserCard.tsx)
- 文件命名: PascalCase for components, camelCase for others
- 使用 React Functional Components + TypeScript
- Props/State 使用 TypeScript 接口
- 状态管理优先 React Hooks
- API 调用统一错误处理

### 后端规范
- 包命名: com.example.chatservice.{layer}
- 类命名: PascalCase
- 方法命名: camelCase
- 使用 `@Transactional` 确保数据一致性
- 统一异常处理 `@ControllerAdvice`
- API 返回标准格式 `ApiResponse<T>`

### API 设计规范
```java
// 标准响应格式
@Data
public class ApiResponse<T> {
    private boolean success;
    private String message;
    private T data;
    private Long timestamp;
}

// RESTful URL设计
GET    /api/v1/habits              # 获取习惯列表
POST   /api/v1/habits              # 创建习惯
PUT    /api/v1/habits/{id}         # 更新习惯
DELETE /api/v1/habits/{id}         # 删除习惯
```

## 核心功能模块

### 1. AI聊天分析 (AIAnalysisService)
- 增强聊天响应生成
- 智能计划需求检测
- 容错和降级机制
- 多轮对话上下文管理

### 2. 智能计划管理 (SmartPlanService)
- 基于AI的个性化计划生成
- 计划状态管理 (DRAFT/ACTIVE/COMPLETED/ARCHIVED)
- 任务分解和时间安排
- 执行进度跟踪

### 3. 习惯管理 (HabitService)
- 习惯CRUD操作
- 完成状态记录
- 统计分析和趋势预测
- 习惯提醒和通知

### 4. 数据分析 (AnalyticsService)
- 个人习惯数据可视化
- 趋势分析和洞察
- 自定义报告生成
- 预测性分析

## 环境配置

### 必需的环境变量
```bash
# OpenAI API配置
export OPENAI_API_KEY="sk-your-api-key"
export OPENAI_BASE_URL="https://fast.yourapi.cn"

# 数据库配置
export DB_URL="jdbc:mysql://localhost:3306/habit_ai"
export DB_USERNAME="root"
export DB_PASSWORD="root"

# Redis配置
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
```

### 服务启动顺序
1. MySQL数据库服务
2. Redis缓存服务
3. 后端Spring Boot应用 (端口 8100)
4. 前端Vite开发服务器 (端口 5173)

## 测试策略

### 前端测试
- 使用 Vitest + @testing-library/react
- 组件单元测试覆盖率 > 80%
- E2E测试使用 Playwright

### 后端测试
- Spring Boot Test + JUnit 5
- 使用 @MockBean 模拟依赖
- 集成测试覆盖关键业务流程

### API测试
- Swagger UI: http://localhost:8100/swagger-ui.html
- 健康检查: http://localhost:8100/actuator/health

## 常见问题解决

### AI服务连接问题
```bash
# 检查API密钥配置
echo $OPENAI_API_KEY | head -c 20

# 测试API连接
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     $OPENAI_BASE_URL/v1/models

# 查看应用日志
tail -f logs/application.log
```

### 数据库连接问题
```bash
# 检查MySQL服务状态
brew services list | grep mysql

# 重置数据库连接
./mvnw spring-boot:run -Dspring-boot.run.arguments="--spring.jpa.hibernate.ddl-auto=create"
```

### 前端代理配置
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8100',
        changeOrigin: true
      }
    }
  }
})
```

## 部署和监控

### 本地开发部署
```bash
# 启动所有服务
docker-compose up -d mysql redis
cd chat_service && ./mvnw spring-boot:run &
cd habi-front && npm run dev
```

### 生产环境配置
- 使用环境变量管理敏感配置
- 启用生产环境日志级别
- 配置监控和告警
- 设置自动备份策略

### 监控指标
- API响应时间 < 500ms
- AI服务调用成功率 > 95%
- 数据库连接池健康状态
- 内存和CPU使用率
- 用户活跃度和功能使用率

## 专业化Agent工具

项目配置了多个专业化Agent，使用 Task 工具调用：

- **code-quality-enforcer**: 代码质量标准化和清理
- **java-backend-architect**: Spring Boot架构设计和优化
- **general-purpose**: 复杂搜索和多步任务处理

使用示例：
```javascript
Task(subagent_type="java-backend-architect", 
     prompt="优化数据库查询性能")
```

## 安全最佳实践

- JWT token自动刷新机制
- API请求限流和防刷
- 敏感数据加密存储
- SQL注入和XSS攻击防护
- CORS跨域访问控制
- 定期安全漏洞扫描

## 性能优化

### 前端优化
- 代码分割和懒加载
- 图片压缩和WebP格式
- Service Worker缓存策略
- 关键渲染路径优化

### 后端优化
- Redis缓存热点数据
- 数据库索引优化
- 连接池配置调优
- 异步处理长耗时操作

## 🚨 代码读写性能规则（重要）

**Claude Code 必须严格遵守的性能优化规则，防止流式中断和响应缓慢：**

### 核心原则
- **禁止**一次性读取超过500行的文件
- **必须**使用 offset 和 limit 参数分批处理大文件
- **必须**使用 MultiEdit 处理大段代码修改
- **应该**先搜索定位（Grep），再精确读取（Read）

### 快速参考
```bash
# ✅ 正确：分批读取大文件
Read(file_path="large.tsx", offset=1, limit=150)    # 第1-150行
Read(file_path="large.tsx", offset=151, limit=150)  # 第151-300行

# ❌ 错误：一次性读取大文件
Read(file_path="large.tsx")  # 1000+行，会导致中断！
```

### 详细规则文档
- [代码读写性能优化规则](/开发文档/前端规则提示词/代码读写性能优化规则.md)
- [Claude Code 性能规则提示词](/开发文档/前端规则提示词/CLAUDE-CODE-性能规则提示词.md)

**重要提醒**：处理大文件时，宁可慢而稳，不可快而断！

---

**维护**: 定期更新技术文档，确保与代码实现同步
**版本**: v2.1 - 增加性能优化规则
**更新**: 2025-01-27
Skill: Git Code Submission (Add, Commit, Push)1. 提交消息规范 (Commit Message Standard)所有 commit message 必须遵循格式：<type>(<scope>): <subject>1.1 Type (必选)类型含义feat新功能fix修复缺陷docs文档变更style代码格式调整 (不影响逻辑)refactor代码重构 (非新增功能/非修复缺陷)perf性能优化test测试代码变更chore构建/依赖/杂项变更1.2 Scope (必选 - 建议范围)auth (认证), chat (聊天), habit (习惯), plan (计划), user (用户), config (配置), api (接口), db (数据库), front (前端), * (全局).1.3 Subject (必选 - 简述)不超过 50 个字符。动词开头 (Add, Fix, Update, Remove 等)。结尾不加句号。2. 操作流程 (Workflow)步骤 1: 添加文件 (Git Add)将修改加入暂存区。Bash# 添加所有变更 (包括新建、修改、删除)
git add -A

# 或者仅添加特定文件
git add filename.java
步骤 2: 提交变更 (Git Commit)将暂存区内容提交到本地仓库，必须严格遵守上述消息规范。Bash# 格式：git commit -m "<type>(<scope>): <subject>"

# 示例：新功能
git commit -m "feat(habit): Add streak calculation logic"

# 示例：修复 Bug
git commit -m "fix(auth): Fix JWT token validation error"

# 示例：性能优化
git commit -m "perf(db): Add index for user queries"
步骤 3: 推送变更 (Git Push)将本地 commit 推送到远程仓库。Bash# 推送到当前对应分支
git push

# (如果是首次推送该分支) 建立上游关联
git push -u origin <branch-name>
3. 最佳实践检查清单 (Checklist)[ ] 原子性：一个 Commit 只做一件事。[ ] 规范性：Message 格式是否符合 <type>(<scope>): <subject>？[ ] 安全性：确认未包含 API Key、密码等敏感信息。[ ] 预检查：Push 前代码已通过编译/测试。

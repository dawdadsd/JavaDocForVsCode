清理规范指南（2025 版，侧重 Java 项目）
在现代开发实践中（尤其是 2025 年 Java 生态），代码质量和一致性是团队协作与系统稳定性的关键。本指南总结了如何在 Python、JavaScript/TypeScript 项目中保持整洁代码，并特别强调 Java 项目的代码规范与质量保障。
Python 项目
需要修复的内容
Black：统一代码格式
isort：自动排序导入
flake8：静态检查，保证代码风格一致
mypy：类型检查，确保静态安全
操作步骤
使用 black . 自动格式化
使用 isort . 排序导入
使用 flake8 . --extend-ignore=E203 解决风格问题
使用 mypy . 检查并修复类型错误
JavaScript/TypeScript 项目
需要修复的内容
Prettier：代码风格统一
ESLint：语法与规范检查
TypeScript 编译器：严格类型校验
操作步骤
npx prettier --write . 自动格式化
npx eslint . --fix 自动修复 ESLint 问题
npx tsc --noEmit 确认 TS 类型无误
Java 项目（重点，符合 2025 实践）
在 Java 生态中，随着 Java 21+ 的普及与 Spring Boot 3.x、虚拟线程、Record 类型 等特性的成熟，代码规范和质量保障尤为重要。
必须遵循的规范
代码格式化
使用 Spotless + Google Java Format 统一格式：
<plugin>
  <groupId>com.diffplug.spotless</groupId>
  <artifactId>spotless-maven-plugin</artifactId>
  <version>2.43.0</version>
  <configuration>
    <java>
      <googleJavaFormat/>
    </java>
  </configuration>
</plugin>
保证行宽 ≤ 120 字符，方法短小清晰。
静态检查
使用 Checkstyle + PMD + ErrorProne，避免常见 bug 模式：
空指针检查
不可达代码检测
不规范命名检测
类型与空安全
使用 @NonNull、@Nullable 明确参数契约
Java 21 提供 ScopedValue，替代部分 ThreadLocal 场景，避免内存泄漏
测试与覆盖率
使用 JUnit 5 + Mockito 编写单元测试
要求覆盖率 ≥ 80%，关键业务 ≥ 90%
现代语法实践
使用 record 定义不可变 DTO
使用 switch 表达式替代多分支 if-else
使用 虚拟线程 (Project Loom) 处理并发请求
使用 sealed interface 控制继承范围
操作步骤
自动化格式化：mvn spotless:apply
静态检查：mvn checkstyle:check pmd:check
错误模式扫描：mvn compile -Xplugin:ErrorProne
运行测试：mvn test 并检查覆盖率报告
代码审查：人工 review 确认无业务逻辑漏洞
通用清理流程
先运行自动格式化工具（Black、Prettier、Spotless）
再修复静态检查工具的剩余问题（flake8、ESLint、Checkstyle）
最后解决类型与编译问题（mypy、TypeScript、Java 编译）
确认所有工具通过检查
审查修改并提交
常见问题
导入顺序冲突：isort/Prettier 与 IDE 自动导入不一致
行宽违规：超过 120 字符需拆分
未使用的变量/导入：应删除
缺少类型注解/返回值声明：Python/TS/Java 均需补充
引号风格：保持一致（JS/TS 使用双引号或 Prettier 默认风格，Java 保持 Google Java Format）

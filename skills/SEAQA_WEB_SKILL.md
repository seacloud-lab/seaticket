# seaqa-web 项目技能

## 这个技能的用途

这个技能用于指导 `seaqa-web` 仓库中的前端开发、排查和维护工作。

它会帮助你在处理页面、组件、接口、国际化、拖拽、编辑器、构建和测试问题时，优先遵循这个项目当前已经在用的技术栈和目录约定。

## 项目范围

- 仓库根目录：`/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web`
- 前端目录：`/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend`
- 前端配置：`/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend/config`
- 前端脚本：`/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend/scripts`

## 技术栈和版本

### 核心框架

- `react` 18.3.1
- `react-dom` 18.3.1
- `prop-types` ^15.6.2
- `classnames` ^2.3.2

### 路由

- `@gatsbyjs/reach-router` 2.0.1

### 数据请求与工具

- `axios` ~1.16.1
- `lodash` ^4.17.21
- `deep-copy` ^1.4.2
- `copy-to-clipboard` 3.3.1
- `js-cookie` ^3.0.7
- `slugid` ^2.0.0
- `jszip` ^3.10.1

### 国际化

- `i18next` ^25.2.1
- `react-i18next` ^15.5.2
- `i18next-browser-languagedetector` ^8.1.0
- `i18next-http-backend` ^3.0.2

### 日期与可视化

- `dayjs` 1.10.7
- `d3` ~7.9.0
- `embedding-atlas` ^0.15.0

### 拖拽与交互

- `react-dnd` ^16.0.1
- `react-dnd-html5-backend` ^16.0.1
- `is-hotkey` 0.2.0

### 表单与 UI

- `reactstrap` 9.2.3
- `react-select` 5.9.0
- `react-responsive` 10.0.0
- `rmc-dialog` 1.1.1
- `rmc-feedback` 2.0.0
- `rmc-tabs` 1.2.29

### 富文本与内容处理

- `@seafile/seafile-editor` 3.0.27
- `@seafile/sea-email-editor` ^0.0.13
- `@seafile/react-image-lightbox` ^5.0.4
- `@seafile/seafile-calendar` 1.0.12
- `unified` 7.0.0

### 构建与样式

- `webpack` (自定义配置)
- `webpack-dev-server`
- `webpack-manifest-plugin`
- `webpack-bundle-tracker`
- `babel-jest`
- `babel-loader`
- `css-loader`
- `less-loader`
- `sass-loader`
- `postcss-loader`
- `mini-css-extract-plugin`
- `style-loader`
- `autoprefixer` 10.4.24
- `postcss-preset-env`

### 测试与质量

- `jest`
- `jest-environment-jsdom`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `eslint`
- `eslint-config-react-app`
- `stylelint` ^17.12.0

## 目录理解方式

在做前端任务时，优先关注这些目录：

| 目录 | 用途 |
|------|------|
| `frontend/src/components` | 通用组件（Icon、Button、Modal 等） |
| `frontend/src/home` | 首页或主业务入口 |
| `frontend/src/project` | 项目相关页面和逻辑（核心业务） |
| `frontend/src/profile-settings` | 用户设置相关 |
| `frontend/src/org-admin` | 组织管理相关 |
| `frontend/src/sys-admin` | 系统管理相关 |
| `frontend/src/api` | 接口封装 |
| `frontend/src/utils` | 工具函数 |
| `frontend/src/models` | 状态或数据模型 |
| `frontend/src/constants` | 常量定义 |
| `frontend/src/css` | 全局样式 |
| `frontend/src/assets` | 静态资源（图标、图片等） |
| `frontend/src/_i18n` | 国际化资源 |
| `frontend/src/tests` | 测试相关 |

## 适用场景

当任务涉及以下内容时，使用这个技能作为工作准则：

- 新增或修改 React 页面、组件、Hooks
- 调整接口请求、参数传递、错误处理
- 新增或修改国际化文案
- 处理拖拽、选择器、弹窗、响应式布局
- 富文本编辑器、邮件编辑器、图片预览等功能
- 排查构建失败、测试失败、样式编译失败、浏览器兼容问题

## 推荐工作方式

### 1. 先定位代码

- 从 `frontend/src` 里找相关模块，而不是先全局改动
- 优先复用已有组件和工具函数
- 如果功能已有同类实现，参考现有实现风格再改

### 2. 再确认依赖

- 请求统一使用 `axios`
- 日期统一使用 `dayjs`
- 国际化统一走 `i18next` / `react-i18next`
- 拖拽统一走 `react-dnd`
- 表单和弹窗优先沿用仓库已存在的 UI 组件（reactstrap、rmc-dialog）

### 3. 最后验证

- 先跑 `lint`
- 再跑相关测试
- 如果改动了构建链路，再跑 `build`

## 常用命令

以下命令都在 `frontend` 目录下执行：

| 命令 | 作用 |
|------|------|
| `npm run lint` | 检查 `src/` 下的 JavaScript 代码 |
| `npm run lint-fix` | 自动修复可修复的 lint 问题 |
| `npm run start` | 启动前端开发环境 |
| `npm run build` | 生产构建 |
| `npm run test` | 运行 Jest 测试 |
| `npm run dev` | 启动本地开发服务 |

示例：

```bash
cd /Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend
npm run lint
npm run build
```

## 代码规范

### JavaScript/React 规范

1. 命名规范：组件使用 PascalCase，函数/变量使用 camelCase，常量使用 UPPER_CASE
2. 导入顺序：外部依赖 → 项目内部依赖 → 样式文件
3. React Hooks：遵循 Hooks 规则，只在函数顶层调用
4. Props 验证：使用 `prop-types` 进行类型验证
5. 条件渲染：优先使用三元运算符或 &&，复杂逻辑抽离为变量

### CSS 规范

1. 类名命名：使用连字符风格（`.seaqa-block-element-modifier`），使用 `seaqa-` 前缀
2. 属性顺序：布局属性 → 盒模型 → 视觉属性
3. 单位使用：使用 `rem` 或 `px`，保持一致性
4. 尽量避免 !important：优先通过选择器优先级解决冲突

## 国际化规范

1. 文案提取：所有用户可见文案必须使用 `gettext()` 包裹
2. Key 命名：使用语义化的 key，如 `gettext('Connect Linear')`
3. 翻译文件：发布新版前，统一更新语言资源文件

## 具体使用方法

### 作为 AI 工作指令使用

如果你把这个技能交给 AI，建议这样使用：

1. 先把这个文件内容作为上下文提供给 AI
2. 再说明当前任务所在目录和目标文件
3. 要求 AI 优先遵循这里列出的目录、命令和依赖
4. 如果是修改代码，要求 AI 同时给出验证步骤

### 作为团队约定使用

- 新人接手前端任务时，先读一遍这个技能
- 做需求开发时，先判断功能属于哪个目录域
- 提交代码前，按这里的命令顺序做检查

## 任务规则

### 代码修改原则

- 优先做最小改动
- 不要引入无必要的新依赖
- 不要为了单次修改随意重构大范围代码
- 保持命名与现有代码一致

### 文案与国际化

- 面向用户的文本优先进入国际化资源
- 不要在组件里硬编码长文案
- 新增文案后，确认对应语言资源都已补齐

### 测试原则

- 新增功能尽量补测试
- 修改已有逻辑时，优先补回归测试

### 构建原则

- 修改资源加载时注意 webpack loader 的影响面
- 修改构建配置后，优先验证 `build` 是否通过

## 常见排查顺序

1. 代码是否导入正确
2. 接口参数是否变化
3. 国际化 key 是否缺失
4. 组件状态是否更新正确
5. 样式是否被 loader 或模块作用域影响
6. 测试是否需要补 mock
7. 构建配置是否兼容当前依赖版本

## 适合交给 AI 的任务描述模板

你可以直接这样说：

```text
请按照 seaqa-web 项目技能处理这个任务。
项目根目录是 /Users/seafile/dev/seaqa-dev/data/dev/seaqa-web。
前端代码在 frontend 目录。
请优先复用现有依赖和目录结构，修改后给我说明影响范围和验证方式。
```

## 备注

- 如果后续 package.json 依赖变化，这个技能文档也要同步更新。

## 更新记录

| 日期 | 更新内容 |
|------|----------|
| 2026-06-10 | 更新技术栈版本，补充目录说明，添加代码规范 |

# seaqa-web AI 提示词指南

这个文档把 `seaqa-web` 项目的前端使用规则、技术规范和可复用提示词模板整理在一起。

你可以直接把它作为给 AI 的工作指令基础，也可以按需替换其中的占位内容。

---

## 📋 快速开始

```text
请按照 seaqa-web 项目规则处理这个任务。
项目根目录：/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web
前端目录：/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend
任务：[你的任务]
目标文件：[文件路径]
要求：优先复用现有实现，最小改动，改后说明影响范围和验证命令。
```

## 1. 项目基本信息

### 目录结构

| 目录 | 路径 | 用途 |
|------|------|------|
| 仓库根目录 | `/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web` | 项目根目录 |
| 前端目录 | `/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend` | 前端代码根目录 |
| 前端脚本 | `/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend/scripts` | 构建和启动脚本 |

### 核心源码目录

```
frontend/src/
├── components/          # 通用组件（Icon、Button、Modal 等）
├── home/                # 首页或主业务入口
├── project/             # 项目相关页面和逻辑
├── profile-settings/    # 用户设置相关
├── org-admin/           # 团队管理相关
├── sys-admin/           # 系统管理相关
├── api/                 # 接口封装
├── utils/               # 工具函数
├── models/              # 数据模型
├── constants/           # 常量定义
├── css/                 # 全局样式
├── assets/              # 静态资源
└── _i18n/               # 国际化资源
```

## 2. 技术栈摘要

### 版本概览

| 分类 | 依赖 | 版本 |
|------|------|------|
| React | `react` | 18.3.1 |
| React DOM | `react-dom` | 18.3.1 |
| 类型检查 | `prop-types` | ^15.6.2 |
| 样式工具 | `classnames` | ^2.3.2 |
| 路由 | `@gatsbyjs/reach-router` | 2.0.1 |
| HTTP 请求 | `axios` | ~1.16.1 |
| 工具库 | `lodash` | ^4.17.21 |
| 日期处理 | `dayjs` | 1.10.7 |
| 国际化 | `i18next` / `react-i18next` | ^25.2.1 |
| 拖拽 | `react-dnd` | ^16.0.1 |
| UI 组件 | `reactstrap` | 9.2.3 |
| 构建工具 | `webpack` | 自定义配置 |
| 测试框架 | `jest` | - |

### 核心框架

- `react` 18.3.1
- `react-dom` 18.3.1
- `prop-types` ^15.6.2
- `classnames` ^2.3.2

### 路由

- `@gatsbyjs/reach-router`

### 请求与工具

- `axios` ~1.16.1 - HTTP 请求
- `lodash` ^4.17.21 - 工具函数库
- `deep-copy` ^1.4.2 - 深拷贝
- `copy-to-clipboard` 3.3.1 - 复制到剪贴板
- `js-cookie` ^3.0.7 - Cookie 操作
- `slugid` ^2.0.0 - UUID 生成
- `jszip` ^3.10.1 - ZIP 文件处理

### 国际化

- `i18next`
- `react-i18next`
- `i18next-browser-languagedetector`
- `i18next-http-backend`

### 日期与可视化

- `dayjs`
- `d3`
- `embedding-atlas`

### 拖拽与交互

- `react-dnd`
- `react-dnd-html5-backend`
- `is-hotkey`

### UI 与表单

- `reactstrap`
- `react-select`
- `react-responsive`
- `rmc-dialog`
- `rmc-feedback`
- `rmc-tabs`

### 富文本与内容处理

- `@seafile/seafile-editor` 3.0.27 - 富文本编辑器
- `@seafile/sea-email-editor` ^0.0.13 - 邮件编辑器
- `@seafile/react-image-lightbox` ^5.0.4 - 图片预览
- `@seafile/seafile-calendar` 1.0.12 - 日历组件
- `unified` 7.0.0 - Markdown 处理

### 构建与样式

- `webpack`
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
- `autoprefixer`
- `postcss-preset-env`

### 测试与质量

- `jest` - 测试框架
- `jest-environment-jsdom` - JSDOM 环境
- `@testing-library/react` - React 测试工具
- `@testing-library/jest-dom` - DOM 断言
- `@testing-library/user-event` - 用户事件模拟
- `eslint` - JavaScript 代码检查
- `eslint-config-react-app` - ESLint 配置
- `stylelint` ^17.12.0 - CSS 代码检查

## 3. 使用原则

### 开发原则

✅ 优先复用：优先查找并复用现有代码、组件和工具函数

✅ 最小改动：尽量做最小改动，避免无必要的重构

✅ 风格一致：保持代码风格与项目现有实现一致

✅ 不添新依赖：不要随意引入新依赖

### 代码规范

| 类型 | 规范 |
|------|------|
| 组件命名 | PascalCase（如 `MyComponent`） |
| 函数/变量 | camelCase（如 `myFunction`） |
| 常量 | UPPER_CASE（如 `MAX_LENGTH`） |
| CSS 类名 | kebab-case 风格（如 `.seaqa-element-modifier`） |
| 文件命名 | kebab-case 风格（如 `my-component.js`） |

### 导入顺序

```javascript
// 1. 外部依赖（按字母顺序）
import React from 'react';
import { Button, Modal } from 'reactstrap';

// 2. 项目内部依赖（按路径深度）
import { gettext } from '@/constants';
import { toaster } from '@/components';

// 3. 样式文件
import './index.css';
```

### 数据与交互

- 请求统一使用 `axios`
- 日期统一使用 `dayjs`
- 拖拽统一使用 `react-dnd`
- 国际化统一走 `i18next` / `react-i18next`
- 面向用户的文案优先进入国际化资源

### 测试与构建

- 修改后优先考虑 `lint`、`test`、`build` 的影响
- 修改样式、loader、构建配置后要验证构建链路

## 4. 目录理解方式

### 目录职责表

| 目录 | 职责 | 说明 |
|------|------|------|
| `components/` | 通用组件 | Icon、Button、Modal 等可复用组件 |
| `home/` | 首页入口 | 工作台首页及主业务入口 |
| `project/` | 项目业务 | 项目相关页面和核心业务逻辑 |
| `profile-settings/` | 用户设置 | 用户个人设置相关 |
| `org-admin/` | 组织管理 | 组织级别管理功能 |
| `sys-admin/` | 系统管理 | 系统级别管理功能 |
| `api/` | 接口封装 | API 请求封装 |
| `utils/` | 工具函数 | 通用工具函数 |
| `models/` | 数据模型 | 数据实体模型 |
| `constants/` | 常量定义 | 全局常量和枚举 |
| `css/` | 全局样式 | 全局 CSS 和主题 |
| `assets/` | 静态资源 | 图标、图片等静态文件 |
| `_i18n/` | 国际化 | 多语言资源文件 |

### 查找代码路径

```
┌─────────────────────────────────────────────────────────────┐
│                    需求分析                                   
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. 判断功能归属：首页? 项目? 设置? 管理?                    
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. 查找同类实现：搜索现有组件/页面                          
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. 复用或扩展：优先复用，必要时扩展                         
└─────────────────────────────────────────────────────────────┘
```

## 5. 常用命令

### 命令速查表

| 命令 | 作用 | 说明 |
|------|------|------|
| `npm run lint` | 检查 JS 代码 | ESLint 检查 `src/` 目录 |
| `npm run lint-fix` | 自动修复 lint | 自动修复可修复的 ESLint 问题 |
| `npm run start` | 启动开发环境 | 热更新开发服务器 |
| `npm run build` | 生产构建 | 完整生产构建 |
| `npm run test` | 运行测试 | Jest 测试套件 |
| `npm run dev` | 启动本地服务 | 开发模式服务器 |

### 使用示例

```bash
# 进入前端目录
cd /Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend

# 检查代码
npm run lint

# 自动修复
npm run lint-fix

# 开发
npm run start

# 构建
npm run build

# 测试
npm run test
```

### 验证流程

```
修改代码
    │
    ▼
npm run lint          # 检查 JS
    │
    ▼
npm run lint:css      # 检查 CSS
    │
    ▼
npm run test          # 运行测试
    │
    ▼
npm run build         # 构建验证
```

## 6. 给 AI 的通用提示词模板

### 6.1 标准版（推荐）

```text
请按照 seaqa-web 项目规则处理以下任务：

📁 项目路径：
- 根目录：/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web
- 前端目录：/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend

🎯 任务目标：
[在这里写具体任务]

📄 目标文件/目录：
[在这里写具体文件或目录]

📋 要求：
1. 先定位相关代码和现有实现
2. 优先复用现有依赖和目录结构
3. 不要随意引入新依赖
4. 尽量做最小改动
5. 面向用户的文案优先走国际化（gettext/t）
6. 修改后说明影响范围和验证方式
7. 如果涉及测试，请给出建议命令
```

### 6.2 精简版

```text
请按照 seaqa-web 项目规则处理任务。

根目录：/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web
前端目录：/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend

任务：[写任务]
目标文件：[写文件或目录]

要求：先找现有实现，最小改动，复用依赖，改后说明影响和验证命令。
```

### 6.3 详细版

```text
请按照 seaqa-web 项目约定处理以下任务：

📁 项目路径：
- 根目录：/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web
- 前端目录：/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend

⚙️ 技术约束：
- 请求统一使用 axios
- 日期统一使用 dayjs
- 国际化使用 i18next / react-i18next（gettext/t）
- 拖拽使用 react-dnd
- UI 组件优先使用 reactstrap
- 状态管理使用 React Hooks（useState/useReducer）

📋 开发原则：
- 优先复用现有组件、工具函数和目录结构
- 不要无必要引入新依赖或大范围重构
- 保持代码风格与现有实现一致
- 面向用户的文案必须进入国际化资源

🎯 本次任务：
[写任务]

📄 目标位置：
[写文件或目录]

🔧 额外要求：
[例如：只改前端、补测试、保持现有接口不变、需要后端配合]

✅ 输出要求：
1. 修改的文件和内容
2. 影响范围分析
3. 验证命令
4. 如果有测试，给出测试建议
```

## 7. 按任务类型使用的模板

### 7.1 改 Bug

```text
请帮我排查并修复 seaqa-web 前端 bug。

🐛 问题描述：
[描述现象，如：点击按钮无响应、样式错乱、接口报错等]

🔄 复现步骤：
1. [步骤1]
2. [步骤2]
3. [步骤3]

✅ 预期结果：
[写预期行为]

📄 当前相关文件：
[列文件或目录，如：frontend/src/components/xxx.js]

🔍 已有线索（可选）：
[如有错误日志、截图、相关代码片段请粘贴]

📋 要求：
1. 先定位根因
2. 给出最小修复方案
3. 如果有测试，补上回归测试
4. 最后说明如何验证修复结果
```

### 7.2 新增页面或功能

```text
请在 seaqa-web 前端中新增功能。

🎯 功能目标：
[写功能描述，如：新增用户管理页面]

📁 页面/模块位置：
[写目录或路由位置，如：frontend/src/org-admin/users/]

🖱️ 交互要求：
1. [交互1，如：点击列表项跳转到详情]
2. [交互2，如：支持搜索过滤]

📊 数据要求：
[写接口或数据结构，如：GET /api/v2/users/ 返回用户列表]

🎨 UI 参考（可选）：
[如有设计稿链接或截图描述]

📋 要求：
1. 优先复用已有页面结构和组件
2. 文案接入国际化（gettext/t）
3. 说明需要修改的文件
4. 给出验证命令
5. 如果需要后端配合，说明接口需求
```

### 7.3 接口联调

```text
请帮我处理 seaqa-web 前端的接口联调问题。

🌐 接口信息：
- 方法：[GET/POST/PUT/DELETE]
- 地址：[接口路径，如：/api/v2/projects/{id}]
- 参数：[请求参数，如：{ name: string }]
- 返回：[响应结构，如：{ data: [], count: number }]

🔴 当前问题：
[写当前报错或异常行为，如：404 错误、数据解析失败、无响应等]

📄 涉及文件：
[列相关文件，如：frontend/src/api/project-api.js]

📋 要求：
1. 先确认现有请求封装方式
2. 按项目现有方式修改 axios 调用
3. 处理错误状态和空数据
4. 添加适当的错误提示
5. 如有必要，补充测试或 mock
```

### 7.4 修测试

```text
请帮我修复 seaqa-web 前端测试。

🔴 失败信息：
[粘贴完整报错信息]

📄 相关测试文件：
[列文件，如：frontend/src/components/Button.test.js]

📄 相关源码文件：
[如有涉及的源码文件]

📋 要求：
1. 先定位测试失败原因
2. 尽量小范围修复
3. 保持现有测试风格（使用 @testing-library/*）
4. 说明是否需要修改代码实现
5. 给出运行测试的命令
```

### 7.5 样式调整

```text
请帮我调整 seaqa-web 前端样式。

🎨 调整目标：
[描述样式需求，如：修改按钮颜色、调整间距等]

📄 相关文件：
[列 CSS/SCSS 文件]

🎯 设计参考（可选）：
[如有设计稿或具体数值]

📋 要求：
1. 使用项目现有样式变量和类名
2. 保持响应式兼容性
3. 说明影响范围
4. 建议验证方式
```

## 8. AI 工作流程建议

### 任务描述结构

给 AI 下任务时，建议按这个顺序提供信息：

1. 项目标识：说明是 seaqa-web 项目
2. 目录路径：给出根目录和前端目录
3. 目标文件：指定要修改的文件或目录
4. 任务目标：清晰描述要做什么
5. 额外约束：技术限制、业务规则
6. 输出要求：期望的交付物

### 推荐写法示例

```text
请按照 seaqa-web 项目规则处理任务。
项目根目录：/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web
前端目录：/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend

任务：修复用户列表页面的搜索功能
目标文件：frontend/src/org-admin/users/index.js

要求：
- 先查看现有搜索实现
- 使用 axios 发起请求
- 文案使用 gettext 国际化
- 改后给出验证命令
```

### AI 工作流程

```
用户给出任务
    │
    ▼
1. 理解需求
    │
    ▼
2. 定位相关代码（搜索现有实现）
    │
    ▼
3. 分析现有模式（依赖、样式、结构）
    │
    ▼
4. 制定修改方案
    │
    ▼
5. 实施修改（最小改动）
    │
    ▼
6. 说明影响范围
    │
    ▼
7. 给出验证命令
```

## 9. 常见排查顺序

### 前端问题排查清单

| 序号 | 检查项 | 排查方法 |
|------|--------|----------|
| 1 | 代码导入 | 检查 import 路径是否正确 |
| 2 | 接口参数 | 查看 Network 请求参数和响应 |
| 3 | 国际化 key | 检查 gettext/t 的 key 是否存在 |
| 4 | 组件状态 | 使用 React DevTools 检查 state |
| 5 | 样式问题 | 检查 CSS 选择器优先级、模块作用域 |
| 6 | 测试失败 | 检查测试断言和 mock 数据 |
| 7 | 构建失败 | 检查 webpack 配置、loader 版本 |
| 8 | 类型错误 | 检查 PropTypes 定义 |
| 9 | 事件绑定 | 检查事件处理器是否正确绑定 |
| 10 | 生命周期 | 检查 useEffect 依赖数组 |

### 错误分类与处理

```
┌─────────────────────────────────────────────────────────────┐
│                    错误类型                                 │
├──────────────────┬──────────────────────────────────────────┤
│ 编译错误          │ 检查语法、导入、类型                       │
├──────────────────┼──────────────────────────────────────────┤
│ 运行时错误        │ 检查状态、props、接口响应                  │
├──────────────────┼──────────────────────────────────────────┤
│ 样式错误          │ 检查选择器、优先级、CSS 变量               │
├──────────────────┼──────────────────────────────────────────┤
│ 测试失败          │ 检查断言、mock、测试数据                  │
├──────────────────┼──────────────────────────────────────────┤
│ 构建失败          │ 检查 webpack 配置、依赖版本               │
└──────────────────┴──────────────────────────────────────────┘
```

## 10. 维护建议

### 文档维护规则

| 变更类型 | 更新内容 | 负责人 |
|----------|----------|--------|
| 依赖升级 | 更新技术栈摘要中的版本号 | 前端负责人 |
| 目录变化 | 更新目录理解方式 | 架构师 |
| 新增命令 | 补充到常用命令区 | 构建负责人 |
| 规范更新 | 更新使用原则和代码规范 | 技术负责人 |
| 模板新增 | 添加到按任务类型模板 | 团队成员 |

### 维护流程

```
1. 当项目有重大变更时
    │
    ▼
2. 更新本指南相关章节
    │
    ▼
3. 同步告知团队成员
    │
    ▼
4. 更新 AI 提示词模板
```

### 更新记录

| 日期 | 更新内容 | 更新人 |
|------|----------|--------|
| 2026-06-10 | 初始版本，整理项目规则和模板 | - |

---

## 📝 附录：常用代码片段

### 国际化

```javascript
import { gettext } from '@/constants';

// 使用 gettext
const label = gettext('Submit');

// JSX 中使用
<span>{gettext('Welcome')}</span>
```

### API 请求

```javascript
import axios from 'axios';

const fetchUsers = async () => {
  try {
    const response = await axios.get('/api/v2/users/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
};
```

### React Hooks

```javascript
import { useState, useEffect } from 'react';

const MyComponent = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData().then(result => {
      setData(result);
      setLoading(false);
    });
  }, []);

  if (loading) return <Loading />;

  return <div>{data}</div>;
};
```

### Icon 组件

```javascript
import { Icon } from '@/components';

// 使用图标
<Icon symbol="check-circle-filled" className="status-icon" />
```

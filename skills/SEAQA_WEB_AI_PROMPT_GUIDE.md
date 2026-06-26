# seaqa-web AI Prompt Guide

This document collects the frontend usage rules, technical conventions, and reusable prompt templates for the `seaqa-web` project.

You can use it directly as the basis for AI work instructions, or replace the placeholders as needed.

---

## Quick Start

```text
Please handle this task according to the seaqa-web project rules.
Project root: /seaqa-web
Frontend directory: /seaqa-web/frontend
Task: [your task]
Target file: [file path]
Requirement: Prefer existing implementations, make minimal changes, and explain the impact scope and verification commands after the change.
```

## 1. Project Basics

### Directory Structure

| Directory | Path | Purpose |
|------|------|------|
| Repository root | `/seaqa-web` | Project root |
| Frontend directory | `/seaqa-web/frontend` | Frontend code root |
| Frontend scripts | `/seaqa-web/frontend/scripts` | Build and startup scripts |

### Core Source Tree

```text
frontend/src/
├── _i18n/                       # Internationalization resources
│   ├── en/                      # English translation resources
│   ├── zh-cn/                   # Simplified Chinese translation resources
│   └── *.js / *.json            # Translation resource definitions
├── api/                         # API wrappers and request helpers
│   ├── *.js                     # Domain-specific API modules
│   └── common.js                # Shared request helpers and wrappers
├── assets/                      # Static assets
│   ├── images/                  # Image assets used by the frontend
│   ├── icons/                   # Icon assets
│   └── fonts/                   # Font assets
├── components/                  # Shared components
│   ├── common/                  # Generic reusable components such as Button, Modal, Icon
│   ├── layout/                  # Layout-related components such as header, sidebar, and page shells
│   └── feedback/                # Feedback components such as toast, loading, empty state
├── constants/                   # Constant definitions
│   ├── *.js                     # Global constants, enums, and fixed configuration
│   └── index.js                 # Constant export entry
├── css/                         # Global styles and theme files
│   ├── index.css                # Global style entry
│   ├── variables.css            # Shared CSS variables
│   └── themes/                  # Theme-related style files
├── home/                        # Home page or main business entry point
│   ├── index.js                 # Home page entry file
│   └── components/              # Home-page-specific components
├── icon-page/                   # Icon preview and icon-related page entry
│   ├── index.js                 # Icon page entry file
│   └── components/              # Icon page components
├── models/                      # Data models
│   ├── *.js                     # Domain model definitions
│   └── index.js                 # Model export entry
├── org-admin/                   # Team administration
│   ├── components/              # Organization admin components
│   ├── index.js                 # Organization admin entry file
│   └── pages/                   # Organization admin pages
├── portal/                      # Portal entry and cross-module navigation
│   ├── index.js                 # Portal entry file
│   └── components/              # Portal-specific components
├── profile-settings/            # User settings
│   ├── components/              # Settings-related components
│   ├── index.js                 # Settings module entry file
│   └── utils/                   # Settings-related helpers
├── project/                     # Project-related pages and logic
│   ├── components/              # Project-specific components
│   ├── index.js                 # Project module entry file
│   ├── pages/                   # Project sub-pages
│   └── utils/                   # Project-specific helper functions
├── sea-metadata/                # Metadata display and parsing related logic
│   ├── index.js                 # Metadata module entry file
│   └── components/              # Metadata-related components
├── sys-admin/                   # System administration
│   ├── components/              # System admin components
│   ├── index.js                 # System admin entry file
│   └── pages/                   # System admin pages
├── tests/                       # Frontend test files and test helpers
│   ├── __mocks__/               # Mock data and mock modules
│   └── utils/                   # Test utility helpers
├── translation.js               # Shared translation helper and i18n bootstrap
└── utils/                       # Utility functions
    ├── date.js                  # Date-related helpers
    ├── format.js                # Formatting helpers
    ├── index.js                 # Utility export entry
    └── validate.js              # Validation helpers
```

## 2. Tech Stack Summary

### Version Overview

| Category | Dependency | Version | Functionality |
|------|------|------|------|
| React | `react` | 18.3.1 | Core UI library for building component-based pages |
| React DOM | `react-dom` | 18.3.1 | Renders React components into the browser DOM |
| Type checking | `prop-types` | ^15.6.2 | Runtime prop type validation for components |
| Styling helper | `classnames` | ^2.3.2 | Conditionally composes CSS class names |
| Routing | `reach-router` | 2.0.1 | Client-side routing and route matching |
| HTTP requests | `axios` | ~1.16.1 | Sends API requests and handles responses/interceptors |
| Utility library | `lodash` | ^4.17.21 | Common utility helpers for data manipulation and control flow |
| Date handling | `dayjs` | 1.10.7 | Parses, formats, and calculates dates and times |
| Internationalization | `i18next` / `react-i18next` | ^25.2.1 | Manages translation resources and React i18n integration |
| Drag and drop | `react-dnd` | ^16.0.1 | Implements drag-and-drop interactions in React |
| UI components | `reactstrap` | 9.2.3 | Bootstrap-based React UI component set |
| Build tool | `webpack` | Custom configuration | Bundles frontend assets for development and production |
| Test framework | `jest` | - | Runs unit and component tests |

### Core Framework

- `react` 18.3.1 - Core UI library for component-driven development
- `react-dom` 18.3.1 - Bridges React components to the browser DOM
- `prop-types` ^15.6.2 - Runtime prop validation for React components
- `classnames` ^2.3.2 - Conditional class name composition utility

### Routing

- `reach-router` - Client-side routing and route matching library

### Requests and Utilities

- `axios` ~1.16.1 - HTTP request library used for API calls, interceptors, and response handling
- `lodash` ^4.17.21 - General-purpose utility functions for collection, object, and string operations
- `deep-copy` ^1.4.2 - Deep clone utility for copying nested data structures
- `copy-to-clipboard` 3.3.1 - Copies text to the system clipboard
- `js-cookie` ^3.0.7 - Reads, writes, and removes browser cookies
- `slugid` ^2.0.0 - Generates UUID-style identifiers for resources or temporary keys
- `jszip` ^3.10.1 - Creates and reads ZIP archives in the browser

### Internationalization

- `gettext` - Translation resource system used to manage localized strings, reference: https://docs.djangoproject.com/zh-hans/6.0/topics/i18n/translation/

### Dates and Visualization

- `dayjs` - Lightweight date parsing, formatting, and manipulation library
- `d3` - Data visualization library, mainly used for drawing statistical charts (such as line charts, bar charts, pie charts, etc.)
- `embedding-atlas` - Embedding visualization library for machine learning-related exploration, including clustering, label generation, and nearest-neighbor search

### Drag and Drop / Interaction

- `react-dnd` - Drag and drop interaction library for React components
- `react-dnd-html5-backend` - HTML5 drag-and-drop backend implementation for `react-dnd`

### Keyboard Shortcuts

- `is-hotkey` - Detects whether a keyboard event matches a hotkey definition

### UI and Forms

- `reactstrap` - Bootstrap component library for React UI layout and controls
- `react-select` - Feature-rich select/dropdown control for React
- `react-responsive` - React media query and responsive rendering helpers
- `rmc-dialog` - Dialog and modal interaction component
- `rmc-feedback` - Feedback/status display component set
- `rmc-tabs` - Tab navigation and panel switching component

### Rich Text and Content Handling

- `@seafile/seafile-editor` 3.0.27 - Rich text editor for document editing and content authoring
- `@seafile/sea-email-editor` ^0.0.13 - Email template editor for composing structured email content
- `@seafile/react-image-lightbox` ^5.0.4 - Full-screen image preview and browsing component
- `@seafile/seafile-calendar` 1.0.12 - Calendar component for date selection and scheduling UI
- `unified` 7.0.0 - Markdown and text transformation pipeline for parsing and rendering content

### Build and Styling

- `webpack` - Bundles JavaScript, styles, and assets for development and production
- `webpack-dev-server` - Provides a local development server with hot reload support
- `webpack-manifest-plugin` - Generates asset manifest files for build outputs
- `webpack-bundle-tracker` - Records bundle output information for integration and analysis
- `babel-jest` - Transforms source code for Jest test execution
- `babel-loader` - Trans piles JavaScript/JSX through Babel during bundling
- `css-loader` - Resolves CSS imports and `url()` references
- `less-loader` - Compiles Less files into CSS
- `sass-loader` - Compiles Sass/SCSS files into CSS
- `postcss-loader` - Processes CSS with PostCSS plugins during build
- `mini-css-extract-plugin` - Extracts CSS into separate files for production builds
- `style-loader` - Injects CSS into the DOM during development
- `autoprefixer` - Adds vendor prefixes based on browser support rules
- `postcss-preset-env` - Enables modern CSS features through PostCSS transforms

### Testing and Quality

- `jest` - test framework
- `jest-environment-jsdom` - JSDOM environment
- `@testing-library/react` - React testing utilities
- `@testing-library/jest-dom` - DOM assertions
- `@testing-library/user-event` - user event simulation
- `eslint` - JavaScript linting
- `eslint-config-react-app` - ESLint configuration
- `stylelint` ^17.12.0 - CSS linting

## 3. Usage Principles

### Development Principles

✅ Prefer reuse: look for and reuse existing code, components, and utility functions first

✅ Minimal changes: make the smallest change possible and avoid unnecessary refactors

✅ Consistent style: keep code style aligned with the project's existing implementation

✅ No new dependencies: do not add new dependencies casually

### Code Conventions

| Type | Convention |
|------|------|
| Component names | PascalCase, such as `MyComponent` |
| Functions/variables | camelCase, such as `myFunction` |
| Constants | UPPER_CASE, such as `MAX_LENGTH` |
| CSS class names | kebab-case, such as `.seaqa-element-modifier` |
| File names | kebab-case, such as `my-component.js` |

### Import Order

```javascript
// 1. External dependencies (alphabetical order)
import React from 'react';
import { Button, Modal } from 'reactstrap';

// 2. Internal project dependencies (by path depth)
import { gettext } from '@/constants';
import { toaster } from '@/components';

// 3. Style files
import './index.css';
```

### Data and Interaction

- Use `axios` for requests
- Use `dayjs` for dates
- Use `react-dnd` for drag and drop
- Use `i18next` / `react-i18next` for internationalization
- User-facing copy should be added to internationalization resources first

### Testing and Build

- After changes, consider the impact on `lint`, `test`, and `build`
- After changing styles, loaders, or build configuration, verify the build pipeline

## 4. Directory Interpretation

### Directory Responsibility Table

| Directory | Responsibility | Description |
|------|------|------|
| `_i18n/` | Internationalization | Multi-language resource files and translation bootstrap. Common subdirectories: `en/`, `zh-cn/` |
| `api/` | API wrappers | Encapsulated API requests and request helpers. Common files: `common.js`, domain API modules |
| `assets/` | Static assets | Static files such as icons, images, and fonts. Common subdirectories: `images/`, `icons/`, `fonts/` |
| `components/` | Shared components | Reusable UI building blocks. Common subdirectories: `common/`, `layout/`, `feedback/` |
| `constants/` | Constant definitions | Global constants, enums, and fixed configuration. Common files: `index.js`, domain constant modules |
| `css/` | Global styles | Global CSS and theme styles. Common subdirectories: `themes/`, shared variable files |
| `home/` | Home entry point | Dashboard home page and main business entry point. Common subdirectories: `components/` |
| `icon-page/` | Icon page | Icon preview and icon-related pages. Common files: `index.js`, feature components |
| `models/` | Data models | Data entity models and schema definitions. Common files: `index.js`, domain model modules |
| `org-admin/` | Organization management | Organization-level administration features. Common subdirectories: `components/`, `pages/` |
| `portal/` | Portal entry | Shared portal entry and cross-module navigation. Common subdirectories: `components/` |
| `profile-settings/` | User settings | User profile and preference settings. Common subdirectories: `components/`, `utils/` |
| `project/` | Project business | Project-related pages and core business logic. Common subdirectories: `components/`, `pages/`, `utils/` |
| `sea-metadata/` | Metadata module | Metadata display, parsing, and related UI logic. Common subdirectories: `components/` |
| `sys-admin/` | System management | System-level administration features. Common subdirectories: `components/`, `pages/` |
| `tests/` | Test assets | Frontend test files, mocks, and test helpers. Common subdirectories: `__mocks__/`, `utils/` |
| `translation.js` | Translation bootstrap | Shared translation helper and i18n initialization entry |
| `utils/` | Utility functions | General utility functions. Common files: `date.js`, `format.js`, `validate.js` |

### Finding Code Paths

```text
┌─────────────────────────────────────────────────────────────┐
│                    Requirement analysis                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Determine the feature area: home? project? settings? admin? │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Find similar implementations: search existing components/pages │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Reuse or extend: prefer reuse, extend only when necessary │
└─────────────────────────────────────────────────────────────┘
```

## 5. Common Commands

### Command Cheat Sheet

| Command | Purpose | Description |
|------|------|------|
| `npm run lint` | Check JS code | ESLint checks the `src/` directory |
| `npm run lint-fix` | Auto-fix lint issues | Automatically fixes fixable ESLint issues |
| `npm run start` | Start development environment | Hot-reload development server |
| `npm run build` | Production build | Full production build |
| `npm run test` | Run tests | Jest test suite |
| `npm run dev` | Start local service | Development-mode server |

### Usage Example

```bash
# Enter the frontend directory
cd /seaqa-web/frontend

# Check code
npm run lint

# Auto-fix
npm run lint-fix

# Development
npm run start

# Build
npm run build

# Tests
npm run test
```

### Verification Flow

```text
Modify code
    │
    ▼
npm run lint          # JS checks
    │
    ▼
npm run lint:css      # CSS checks
    │
    ▼
npm run test          # Run tests
    │
    ▼
npm run build         # Build verification
```

## 6. General Prompt Templates for AI

### 6.1 Standard Version (Recommended)

```text
Please handle the following task according to the seaqa-web project rules:

📁 Project paths:
- Root: /seaqa-web
- Frontend: /seaqa-web/frontend

🎯 Task goal:
[write the task here]

📄 Target file/directory:
[write the file or directory here]

📋 Requirements:
1. First locate the relevant code and existing implementation
2. Prefer existing dependencies and directory structure
3. Do not add new dependencies casually
4. Make the smallest change possible
5. Prefer internationalization for user-facing copy (gettext/t)
6. After the change, explain the impact scope and verification method
7. If tests are involved, provide suggested commands
```

### 6.2 Minimal Version

```text
Please handle this task according to the seaqa-web project rules.

Root: /seaqa-web
Frontend: /seaqa-web/frontend

Task: [write the task]
Target file: [write the file or directory]

Requirement: find existing implementation first, make minimal changes, reuse dependencies, and explain the impact and verification commands after the change.
```

### 6.3 Detailed Version

```text
Please handle the following task according to the seaqa-web project conventions:

📁 Project paths:
- Root: /seaqa-web
- Frontend: /seaqa-web/frontend

⚙️ Technical constraints:
- Use axios for requests
- Use dayjs for dates
- Use i18next / react-i18next for internationalization (gettext/t)
- Use react-dnd for drag and drop
- Prefer reactstrap for UI components
- Use React Hooks (useState/useReducer) for state management

📋 Development principles:
- Prefer existing components, utility functions, and directory structure
- Do not introduce new dependencies or large refactors unless necessary
- Keep code style consistent with existing implementations
- User-facing copy must be added to internationalization resources

🎯 Task:
[write the task]

📄 Target location:
[write the file or directory]

🔧 Additional requirements:
[for example: frontend only, add tests, keep the current API unchanged, backend coordination needed]

✅ Output requirements:
1. Files and content changed
2. Impact scope analysis
3. Verification commands
4. If tests are added, provide test suggestions
```

## 7. Templates by Task Type

### 7.1 Bug Fix

```text
Please help me investigate and fix a seaqa-web frontend bug.

🐛 Problem description:
[describe the symptom, such as: clicking a button does nothing, broken styles, API errors, etc.]

🔄 Steps to reproduce:
1. [step 1]
2. [step 2]
3. [step 3]

✅ Expected result:
[write the expected behavior]

📄 Current related files:
[list files or directories, such as: frontend/src/components/xxx.js]

🔍 Existing clues (optional):
[paste error logs, screenshots, or relevant code snippets if available]

📋 Requirements:
1. Find the root cause first
2. Provide the smallest possible fix
3. If tests exist, add a regression test
4. Finally explain how to verify the fix
```

### 7.2 Add a Page or Feature

```text
Please add a new feature to the seaqa-web frontend.

🎯 Feature goal:
[write the feature description, such as: add a user management page]

📁 Page/module location:
[write the directory or route location, such as: frontend/src/org-admin/users/]

🖱️ Interaction requirements:
1. [interaction 1, such as: clicking a list item opens details]
2. [interaction 2, such as: support search filtering]

📊 Data requirements:
[write the API or data structure, such as: GET /api/v2/users/ returns a user list]

🎨 UI reference (optional):
[design link or screenshot description, if available]

📋 Requirements:
1. Prefer existing page structures and components
2. Connect user-facing copy to internationalization (gettext/t)
3. Explain which files need to be modified
4. Provide verification commands
5. If backend support is needed, describe the API requirements
```

### 7.3 API Integration

```text
Please help me handle a frontend API integration issue in seaqa-web.

🌐 API information:
- Method: [GET/POST/PUT/DELETE]
- URL: [API path, such as: /api/v2/projects/{id}]
- Parameters: [request parameters, such as: { name: string }]
- Response: [response structure, such as: { data: [], count: number }]

🔴 Current issue:
[write the current error or abnormal behavior, such as: 404 error, parsing failure, no response, etc.]

📄 Related files:
[list related files, such as: frontend/src/api/project-api.js]

📋 Requirements:
1. First confirm the existing request wrapper pattern
2. Modify the axios call according to the project's existing approach
3. Handle error states and empty data
4. Add appropriate error messages
5. Add tests or mocks if necessary
```

### 7.4 Fix Tests

```text
Please help me fix a seaqa-web frontend test.

🔴 Failure message:
[paste the full error message]

📄 Related test files:
[list files, such as: frontend/src/components/Button.test.js]

📄 Related source files:
[source files involved, if any]

📋 Requirements:
1. First identify why the test failed
2. Keep the fix as small as possible
3. Keep the existing testing style (use @testing-library/*)
4. Explain whether the implementation code also needs changes
5. Provide the command to run the test
```

### 7.5 Style Adjustment

```text
Please help me adjust the seaqa-web frontend styles.

🎨 Adjustment goal:
[describe the style change, such as: change button color, adjust spacing, etc.]

📄 Related files:
[list CSS/SCSS files]

🎯 Design reference (optional):
[design mock or specific values, if available]

📋 Requirements:
1. Use the project's existing style variables and class names
2. Keep responsive compatibility
3. Explain the impact scope
4. Suggest how to verify the change
```

## 8. AI Workflow Recommendations

### Task Description Structure

When assigning a task to AI, provide the information in this order:

1. Project identifier: state that it is the seaqa-web project
2. Directory paths: provide the root directory and frontend directory
3. Target files: specify the files or directories to modify
4. Task goal: clearly describe what needs to be done
5. Additional constraints: technical limits, business rules
6. Output requirements: expected deliverables

### Recommended Example

```text
Please handle the task according to the seaqa-web project rules.
Project root: /seaqa-web
Frontend directory: /seaqa-web/frontend

Task: Fix the search feature on the user list page
Target file: frontend/src/org-admin/users/index.js

Requirements:
- First review the existing search implementation
- Use axios to send requests
- Use gettext for internationalized copy
- Provide verification commands after the change
```

### AI Workflow

```text
User provides a task
    │
    ▼
1. Understand the requirement
    │
    ▼
2. Locate the relevant code (search for existing implementation)
    │
    ▼
3. Analyze existing patterns (dependencies, styles, structure)
    │
    ▼
4. Plan the change
    │
    ▼
5. Implement the change (minimal edits)
    │
    ▼
6. Explain the impact scope
    │
    ▼
7. Provide verification commands
```

## 9. Common Troubleshooting Order

### Frontend Troubleshooting Checklist

| No. | Check | How to investigate |
|------|------|------|
| 1 | Code imports | Check whether the import path is correct |
| 2 | API parameters | Inspect Network request parameters and response |
| 3 | i18n keys | Check whether the gettext/t key exists |
| 4 | Component state | Use React DevTools to inspect state |
| 5 | Style issues | Check CSS selector specificity and module scoping |
| 6 | Test failures | Check test assertions and mock data |
| 7 | Build failures | Check webpack config and loader versions |
| 8 | Type errors | Check PropTypes definitions |
| 9 | Event binding | Check whether event handlers are bound correctly |
| 10 | Lifecycle | Check the `useEffect` dependency array |

### Error Classification and Handling

```text
┌─────────────────────────────────────────────────────────────┐
│                    Error type                               │
├──────────────────┬──────────────────────────────────────────┤
│ Compilation error │ Check syntax, imports, and types        │
├──────────────────┼──────────────────────────────────────────┤
│ Runtime error     │ Check state, props, and API response    │
├──────────────────┼──────────────────────────────────────────┤
│ Style error       │ Check selectors, specificity, CSS vars  │
├──────────────────┼──────────────────────────────────────────┤
│ Test failure      │ Check assertions, mocks, test data      │
├──────────────────┼──────────────────────────────────────────┤
│ Build failure     │ Check webpack config and dependency versions │
└──────────────────┴──────────────────────────────────────────┘
```

## 10. Maintenance Recommendations

### Documentation Maintenance Rules

| Change type | Update content | Owner |
|----------|----------|--------|
| Dependency upgrade | Update version numbers in the tech stack summary | Frontend lead |
| Directory changes | Update the directory interpretation section | Architect |
| New command | Add it to the common commands section | Build owner |
| Convention updates | Update usage principles and code conventions | Technical lead |
| New templates | Add them to the task-type template section | Team members |

### Maintenance Process

```text
1. When the project has a major change
    │
    ▼
2. Update the relevant sections of this guide
    │
    ▼
3. Notify the team members
    │
    ▼
4. Update the AI prompt templates
```

### Update Log

| Date | Changes | Updated by |
|------|----------|--------|
| 2026-06-10 | Initial version, organized project rules and templates | - |

---

## Appendix: Common Code Snippets

### Internationalization

```javascript
import { gettext } from '@/constants';

// Using gettext
const label = gettext('Submit');

// Using in JSX
<span>{gettext('Welcome')}</span>
```

### API Request

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

### Icon Component

```javascript
import { Icon } from '@/components';

// Use an icon
<Icon symbol="check-circle-filled" className="status-icon" />
```

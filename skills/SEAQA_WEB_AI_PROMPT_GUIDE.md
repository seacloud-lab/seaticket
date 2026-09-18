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
├── _i18n/                       # Editor-specific internationalization
│   └── i18n-seafile-editor.js   # Seafile editor translation setup
├── api/                         # Shared API modules
│   ├── notification-api.js      # Notification API
│   └── user-api.js              # User API
├── assets/                      # Static assets
│   ├── css/                     # Asset-specific styles
│   └── icons/                   # SVG icons
├── components/                  # Shared reusable components
│   ├── account/                 # Account-related components
│   ├── btn/                     # Button components
│   ├── chart/                   # Chart components
│   ├── common/                  # Shared common components
│   ├── customize-select/        # Select controls
│   ├── customize-table/         # Table components
│   ├── dialog/                  # Dialog components
│   ├── mobile/                  # Mobile-specific components
│   ├── options-editor/          # Options editor components
│   ├── search-input/            # Search input components
│   ├── settings/                # Settings components
│   ├── tooltip/                 # Tooltip components
│   ├── toaster/                 # Toast notifications
│   ├── index.js                 # Shared component exports
│   └── *.js                     # Standalone shared components
├── constants/                   # Global constants and configuration
│   ├── config.js                # Frontend configuration
│   ├── navigation.js            # Navigation constants
│   ├── permission.js            # Permission constants
│   └── index.js                 # Constant exports
├── css/                         # Global styles
│   ├── admin-common.css         # Administration styles
│   ├── layout.css               # Layout styles
│   ├── side-panel.css           # Side panel styles
│   ├── statistics.css           # Statistics styles
│   └── toolbar.css              # Toolbar styles
├── home/                        # Home page and workspace management
│   ├── components/              # Home-specific components
│   ├── dialog/                  # Home dialogs
│   ├── dropdown-menu/            # Home dropdown menus
│   ├── header/                  # Home header
│   ├── main-panel/              # Home main panel
│   ├── mobile/                  # Mobile home views
│   ├── models/                  # Home models
│   ├── popover/                 # Home popovers
│   ├── search/                  # Home search
│   ├── side-panel/              # Home side panel
│   ├── workspace/               # Workspace views
│   ├── api.js                   # Home API module
│   └── index.js                 # Home entry file
├── icon-page/                   # Icon-related views
│   ├── down/                    # Download-related icon view
│   ├── eye-icon/                # Eye icon view
│   └── more/                    # More icon view
├── models/                      # Shared data models
│   ├── system-admin/            # System administration models
│   └── *.js                     # Domain model definitions
├── org-admin/                   # Organization administration
│   ├── group-info/              # Group information
│   ├── group-members/           # Group members
│   ├── group-projects/          # Group projects
│   ├── groups/                  # Group management
│   ├── info/                    # Organization information
│   ├── main-panel/              # Administration main panel
│   ├── models/                  # Organization admin models
│   ├── projects/                # Organization projects
│   ├── saml/                    # SAML settings
│   ├── settings/                # Organization settings
│   ├── statistics/              # Organization statistics
│   ├── user-profile/            # User profiles
│   ├── users/                   # User management
│   ├── api.js                   # Organization admin API
│   └── index.js                 # Organization admin entry file
├── portal/                      # Portal views and navigation
│   ├── api/                     # Portal API modules
│   ├── hooks/                   # Portal hooks
│   ├── left-bar/                # Portal left bar
│   ├── main-panel/              # Portal main panel
│   ├── side-panel/              # Portal side panel
│   ├── constants.js             # Portal constants
│   ├── path-utils.js            # Portal path helpers
│   └── index.js                 # Portal entry file
├── profile-settings/            # User profile and settings
│   ├── dialog/                  # Settings dialogs
│   ├── password-widgets/        # Password controls
│   ├── session-logs/            # Session logs
│   ├── api.js                   # Profile settings API
│   └── index.js                 # Profile settings entry file
├── project/                     # Project views and business logic
│   ├── api/                     # Project API modules
│   ├── components/              # Project components
│   ├── constants/               # Project constants
│   ├── hooks/                   # Project hooks
│   ├── main-panel/              # Project main panel
│   ├── side-panel/              # Project side panel
│   ├── index.js                 # Project entry file
│   └── utils.js                 # Project utilities
├── sea-metadata/                # Metadata display and editing
│   ├── components/              # Metadata components
│   ├── constants/               # Metadata constants
│   ├── hooks/                   # Metadata hooks
│   ├── models/                  # Metadata models
│   ├── store/                   # Metadata state management
│   ├── utils/                   # Metadata utilities
│   ├── view/                    # Metadata views
│   ├── context.js               # Metadata context
│   ├── index.js                 # Metadata entry file
│   └── render.js                # Metadata renderer
├── sys-admin/                   # System administration
│   ├── dialog/                  # System admin dialogs
│   ├── group/                   # Group detail views
│   ├── groups/                  # Group management
│   ├── info/                    # System information
│   ├── main-panel/              # Administration main panel
│   ├── org/                     # Organization detail views
│   ├── orgs/                    # Organization management
│   ├── projects/                # Project management
│   ├── statistics/              # System statistics
│   ├── sys-constants/           # System admin constants
│   ├── sys-popover/             # System admin popovers
│   ├── user/                    # User detail views
│   ├── users/                   # User management
│   ├── api.js                   # System admin API
│   ├── constants.js              # System admin constants
│   └── index.js                 # System admin entry file
├── tests/                       # Frontend tests
│   └── *.test.js                # Utility and component tests
├── translation.js               # Shared translation helper and bootstrap
└── utils/                       # Shared utility functions
    ├── validate/                # Validation utilities
    └── *.js                     # Date, DOM, storage, and other helpers
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
- `@seafile/seafile-calendar` 1.0.23 - Calendar component for date selection and scheduling UI
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

| Directory | Responsibility |
|------|------|------|
| `_i18n/` | Editor internationalization |
| `api/` | Shared API modules |
| `assets/` | Static assets |
| `components/` | Shared reusable components |
| `constants/` | Global constants and configuration |
| `css/` | Global styles |
| `home/` | Home page and workspace management |
| `icon-page/` | Icon-related views |
| `models/` | Shared data models |
| `org-admin/` | Organization administration |
| `portal/` | Portal views and navigation |
| `profile-settings/` | User profile and settings |
| `project/` | Project views and business logic |
| `sea-metadata/` | Metadata display and editing |
| `sys-admin/` | System administration |
| `tests/` | Frontend tests |
| `translation.js` | Translation bootstrap |
| `utils/` | Shared utility functions |

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

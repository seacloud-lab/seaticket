# seaqa-web Project Skill

## Purpose

This skill guides frontend development, troubleshooting, and maintenance work in the `seaqa-web` repository.

It helps you follow the project's existing tech stack and directory conventions first when working on pages, components, APIs, internationalization, drag and drop, editors, builds, and tests.

## Project Scope

- Repository root: `/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web`
- Frontend directory: `/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend`
- Frontend config: `/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend/config`
- Frontend scripts: `/Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend/scripts`

## Tech Stack and Versions

### Core Framework

- `react` 18.3.1
- `react-dom` 18.3.1
- `prop-types` ^15.6.2
- `classnames` ^2.3.2

### Routing

- `@gatsbyjs/reach-router` 2.0.1

### Data Fetching and Utilities

- `axios` ~1.16.1
- `lodash` ^4.17.21
- `deep-copy` ^1.4.2
- `copy-to-clipboard` 3.3.1
- `js-cookie` ^3.0.7
- `slugid` ^2.0.0
- `jszip` ^3.10.1

### Internationalization

- `i18next` ^25.2.1
- `react-i18next` ^15.5.2
- `i18next-browser-languagedetector` ^8.1.0
- `i18next-http-backend` ^3.0.2

### Dates and Visualization

- `dayjs` 1.10.7
- `d3` ~7.9.0
- `embedding-atlas` ^0.15.0

### Drag and Drop / Interaction

- `react-dnd` ^16.0.1
- `react-dnd-html5-backend` ^16.0.1
- `is-hotkey` 0.2.0

### Forms and UI

- `reactstrap` 9.2.3
- `react-select` 5.9.0
- `react-responsive` 10.0.0
- `rmc-dialog` 1.1.1
- `rmc-feedback` 2.0.0
- `rmc-tabs` 1.2.29

### Rich Text and Content Handling

- `@seafile/seafile-editor` 3.0.27
- `@seafile/sea-email-editor` ^0.0.13
- `@seafile/react-image-lightbox` ^5.0.4
- `@seafile/seafile-calendar` 1.0.12
- `unified` 7.0.0

### Build and Styling

- `webpack` (custom configuration)
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

### Testing and Quality

- `jest`
- `jest-environment-jsdom`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `eslint`
- `eslint-config-react-app`
- `stylelint` ^17.12.0

## Directory Mapping

When working on frontend tasks, focus on these directories first:

| Directory | Purpose |
|------|------|
| `frontend/src/components` | Shared components (Icon, Button, Modal, etc.) |
| `frontend/src/home` | Home page or main business entry point |
| `frontend/src/project` | Project-related pages and logic (core business) |
| `frontend/src/profile-settings` | User settings |
| `frontend/src/org-admin` | Organization administration |
| `frontend/src/sys-admin` | System administration |
| `frontend/src/api` | API wrappers |
| `frontend/src/utils` | Utility functions |
| `frontend/src/models` | State or data models |
| `frontend/src/constants` | Constant definitions |
| `frontend/src/css` | Global styles |
| `frontend/src/assets` | Static assets such as icons and images |
| `frontend/src/_i18n` | Internationalization resources |
| `frontend/src/tests` | Test-related files |

## Applicable Scenarios

Use this skill as the working guideline when tasks involve any of the following:

- Adding or modifying React pages, components, or Hooks
- Adjusting API requests, parameter passing, or error handling
- Adding or modifying i18n copy
- Handling drag and drop, selectors, modals, or responsive layouts
- Rich text editor, email editor, image preview, and similar features
- Troubleshooting build failures, test failures, style compilation failures, or browser compatibility issues

## Recommended Workflow

### 1. Locate the Code First

- Find the relevant module under `frontend/src` instead of making broad global changes first
- Prefer reusing existing components and utility functions
- If a similar implementation already exists, follow that style before making changes

### 2. Confirm Dependencies

- Use `axios` for requests
- Use `dayjs` for dates
- Use `i18next` / `react-i18next` for internationalization
- Use `react-dnd` for drag and drop
- Prefer existing UI components already in the repository for forms and dialogs (`reactstrap`, `rmc-dialog`)

### 3. Verify Last

- Run `lint` first
- Then run the relevant tests
- If the build pipeline changed, run `build`

## Common Commands

Run all of the following commands from the `frontend` directory:

| Command | Purpose |
|------|------|
| `npm run lint` | Check JavaScript code under `src/` |
| `npm run lint-fix` | Automatically fix lint issues that can be fixed |
| `npm run start` | Start the frontend development environment |
| `npm run build` | Production build |
| `npm run test` | Run Jest tests |
| `npm run dev` | Start the local development service |

Example:

```bash
cd /Users/seafile/dev/seaqa-dev/data/dev/seaqa-web/frontend
npm run lint
npm run build
```

## Code Style

### JavaScript / React Style

1. Naming: use PascalCase for components, camelCase for functions and variables, and UPPER_CASE for constants
2. Import order: external dependencies -> internal project dependencies -> style files
3. React Hooks: follow the Rules of Hooks and only call hooks at the top level of a function
4. Props validation: use `prop-types` for type checking
5. Conditional rendering: prefer ternaries or `&&`; extract complex logic into variables

### CSS Style

1. Class naming: use hyphenated style (`.seaqa-block-element-modifier`) with the `seaqa-` prefix
2. Property order: layout properties -> box model -> visual properties
3. Units: use `rem` or `px` consistently
4. Avoid `!important` when possible: resolve conflicts through selector specificity first

## Internationalization Rules

1. Copy extraction: all user-visible text must be wrapped in `gettext()`
2. Key naming: use semantic keys, such as `gettext('Connect Linear')`
3. Translation files: update language resource files before a new release

## How to Use

### As AI Work Instructions

If you give this skill to an AI, use it like this:

1. Provide the content of this file to the AI as context first
2. Then specify the current task directory and target files
3. Ask the AI to follow the directories, commands, and dependencies listed here first
4. If code changes are involved, ask the AI to include verification steps as well

### As a Team Convention

- New frontend contributors should read this skill first
- When developing features, identify which directory domain the feature belongs to first
- Before submitting code, follow the command order listed here for checks

## Task Rules

### Code Change Principles

- Prefer minimal changes
- Do not introduce unnecessary new dependencies
- Do not casually refactor large areas of code for a one-off change
- Keep naming consistent with the existing codebase

### Copy and Internationalization

- User-facing text should go into i18n resources first
- Do not hardcode long copy directly in components
- After adding copy, make sure the corresponding language resources are complete

### Testing Principles

- Add tests for new features when possible
- When changing existing logic, prioritize regression tests

### Build Principles

- When changing asset loading, pay attention to the impact of webpack loaders
- After changing build configuration, verify that `build` still passes

## Common Troubleshooting Order

1. Whether the code is imported correctly
2. Whether API parameters changed
3. Whether any i18n keys are missing
4. Whether component state updates correctly
5. Whether styles are affected by loaders or module scoping
6. Whether tests need additional mocks
7. Whether the build configuration is compatible with the current dependency versions

## Task Description Template for AI

You can say this directly:

```text
Please handle this task according to the seaqa-web project skill.
The project root is /Users/seafile/dev/seaqa-dev/data/dev/seaqa-web.
The frontend code is in the frontend directory.
Please prioritize existing dependencies and directory structure, and after the changes explain the impact scope and verification steps.
```

## Notes

- If package.json dependencies change later, this skill document should be updated accordingly.

## Changelog

| Date | Changes |
|------|----------|
| 2026-06-10 | Updated tech stack versions, expanded directory notes, added code style guidelines |

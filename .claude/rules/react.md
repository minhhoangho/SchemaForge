---
paths:
  - "frontend/**/*.tsx"
---

# React

## Components

- Function components with named exports, one exported component per file. The file name is the component name in kebab-case: `TableNode` lives in `table-node.tsx`.
- Type props with `type <Name>Props` and destructure them in the signature. Don't use `React.FC`.
- Keep components presentational. Move logic into custom hooks (`use-table-selection.ts`) or feature state.
- Prefer composition (`children`, slot props) over piling on boolean props; split a component that needs many flags.

## State and effects

- Don't store what can be derived; compute it during render.
- `useEffect` is only for syncing with external systems (DOM APIs, subscriptions, storage). Handle user actions in event handlers, not effects.
- Effects that subscribe, listen, or start timers return a cleanup.
- Keep state as local as possible. Use global state only for data shared by distant components, such as the editor schema and UI preferences.
- Subscribe to narrow slices of global state so a change to one table doesn't re-render the whole canvas.
- Update state immutably.

## Hooks

- Follow the Rules of Hooks. Keep dependency arrays complete; never disable `react-hooks/exhaustive-deps`.
- Custom hooks start with `use` and return typed, stable values.

## Performance

- Don't add `memo`, `useMemo`, or `useCallback` by default. Add them where profiling shows a cost or referential stability is required, such as canvas node and edge renderers.
- Use stable ids as `key`s, never array indexes for lists that can reorder.

## Accessibility

Target: WCAG 2.2 level AA.

- Semantic elements first: `button` for actions, `Link` for navigation. No clickable `div`s.
- Every interactive element is keyboard reachable, has a visible focus style, and has an accessible name.
- Form fields have labels; icon-only buttons have a translated `aria-label`.
- Dialogs trap focus, close on `Escape`, and return focus to the trigger.
- Every drag has both a keyboard path and a single-pointer (click or tap) alternative without dragging (2.5.7). The spec names which alternative each feature uses.
- Pointer targets are at least 24×24 CSS px, or spaced so a 24 px circle around each overlaps no other target (2.5.8). A smaller target is allowed when an equivalent control elsewhere does the same thing.
- A focused element is never fully hidden behind panels, toolbars, the minimap, toasts, or sticky headers (2.4.11).
- Sign-in and sign-up forms allow paste and password-manager autofill with correct `autocomplete` values, and use no puzzle CAPTCHA or other cognitive test (3.3.8).

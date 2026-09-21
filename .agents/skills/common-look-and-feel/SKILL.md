---
name: common-look-and-feel
description: "Use when building or changing frontend UI, UX, styling, layouts, pages, components, dashboards, forms, or visual states. Enforce this project's Common Look and Feel color palette and design tokens consistently."
---

# Common Look and Feel

Use this palette for Common Look and Feel.

## Project Enforcement

`frontend/common-look-and-feel.json` is this project's committed frontend policy:

```json
{ "enforced": true }
```

Apply this skill's palette, light-only rules, and verification checklist to all frontend UI work in this project. Do not add an opt-in prompt, fallback mode, or disable toggle.

When a request conflicts with Common Look and Feel, including a dark theme, dark-mode toggle, dark surface palette, or non-palette core interface tokens, do not implement the conflicting design. Explain the restriction and provide a palette-compliant alternative when one exists.

## Use This Skill When

- Building or changing frontend UI, UX, pages, layouts, components, dashboards, forms, or visual states.
- Applying the Common Look and Feel palette to a new or existing project.
- Replacing hardcoded CSS colors, CSS variables, or Tailwind color utilities with semantic tokens.
- Keeping colors consistent while implementing an otherwise unrelated frontend feature.
- Replacing an existing dark visual design with this project's light palette.

## Do Not Use This Skill To

- Change typography, spacing, sizing, border radius, shadows, motion, layout, navigation, DOM hierarchy, or component behavior during a color-only update.
- Redesign controls, cards, dialogs, tables, navigation, or the application shell.
- Add components, wrappers, gradients, decorative elements, or missing interaction states merely to use the palette.
- Introduce or retain a dark theme, dark-mode palette, dark-mode toggle, `prefers-color-scheme: dark` rule, or Tailwind `dark:` color utility.

## Scope Boundary

- Common Look and Feel is light-only: use `surface`, `surface-subtle`, and `surface-muted` for backgrounds and panels. Do not add dark surface tokens or dark-theme overrides.
- When dark-theme visual styles already exist, remove their color declarations and replace the rendered UI with the light palette. Do not create an alternate dark appearance.
- Preserve the existing layout, component structure, typography, spacing, sizing, radii, shadows, motion, navigation, and behavior unless the user separately requests a change.
- A production edit must be directly attributable to a color value, color token, color utility, or removal of a dark-theme color rule.
- If a required contrast pair cannot pass without changing non-color design properties, stop and report the conflict rather than expanding scope.

## Apply It To A Project

Copy the artifact that matches the project's styling stack before building the interface:

- Plain CSS: copy [theme.css](theme.css) into the application and import it before application styles. Use tokens such as `var(--color-primary)`.
- Tailwind CSS v4: copy [tailwind.theme.css](tailwind.theme.css) into the application and import it after `tailwindcss`.
- Tailwind CSS v3: copy [tailwind.theme.json](tailwind.theme.json) into the Tailwind configuration's `theme.extend.colors`.

### Required Migration Order

1. Identify whether the frontend uses plain CSS, Tailwind v4, or Tailwind v3.
2. Copy and integrate the matching palette artifact before editing component styles.
3. Replace existing hardcoded colors with the integrated semantic tokens. Do not merely load the artifact while leaving the UI on independent color values.
4. Remove dark-theme selectors, dark-mode state and toggle code, and dark color declarations. Replace rendered surfaces and text with the light palette tokens.
5. Search the changed frontend files for dark-theme remnants before completing the work: `dark:`, `prefers-color-scheme: dark`, `data-theme="dark"`, dark-mode class names, and dark background or text variables.

Plain CSS import:

```css
@import "./theme.css";
```

Tailwind v4 import:

```css
@import "tailwindcss";
@import "./tailwind.theme.css";
```

For Tailwind v3, merge the `colors` object from `tailwind.theme.json` into the existing `theme.extend.colors`; preserve the project's other theme values, plugins, presets, and content paths.

```js
import palette from "./tailwind.theme.json";

export default {
	theme: {
		extend: {
			colors: {
				// Preserve existing project colors.
				...palette.colors,
			},
		},
	},
};
```

The Tailwind tokens produce utilities such as `bg-primary`, `text-primary-dark`, `border-border`, and `bg-surface-subtle`.

## Apply Colors Only

Map existing colors by semantic role before editing. Replace hardcoded color values, CSS variables, or Tailwind color utilities with the closest palette token.

- Keep existing controls, layout, spacing, typography, borders, radii, shadows, and interaction behavior unchanged during a color-only update.
- Do not add a missing state, wrapper, gradient, card, or decorative element merely to use the palette.
- Retain the geometry of focus indicators while updating their color to `focus`.
- Preserve labels, icons, and accessibility semantics; color alone must not convey status.
- Remove dark-theme color rules rather than creating dark equivalents of the palette.

| Token | Hex | Use |
|---|---:|---|
| `primary` | `#005A53` | Primary actions, links, selected states |
| `primary-dark` | `#003531` | Hover states, dense navigation |
| `primary-active` | `#001C19` | Pressed states |
| `accent` | `#E88219` | Decorative rules, large emphasis, charts |
| `accent-accessible` | `#B15315` | White-text interactive orange surfaces |
| `accent-selected` | `#733208` | Selected warning or tag surfaces with white text |
| `text` | `#333333` | Primary text |
| `text-muted` | `#6C757D` | Secondary metadata on white |
| `surface` | `#FFFFFF` | Main surfaces and reversed text |
| `surface-subtle` | `#F7F7F7` | Page canvas and alternate rows |
| `surface-muted` | `#ECECEC` | Muted structural regions |
| `surface-disabled` | `#EAEAEA` | Disabled controls |
| `border` | `#CECECE` | Dividers and control boundaries |
| `table-header` | `#FFF2EA` | Warm table and list headers |
| `focus` | `#005A53` | Focus indicators |
| `danger` | `#DC3545` | Error and destructive states |
| `success` | `#005A53` | Positive states, paired with a label |

## Usage Rules

- Use green as the structural and interactive anchor; use orange sparingly for emphasis.
- Use `accent-accessible`, not `accent`, for white-text controls.
- Default text uses `text`; use `surface` only as an explicit reversed foreground on a contrast-safe colored surface.
- Status tags, badges, and controls must explicitly set both foreground and background tokens. Do not infer their text color from the page or parent element.
- When reviewing an existing component, inspect its most specific selector and computed foreground/background pair. A local `color` declaration overrides inherited `text` by design when it provides the required contrast.
- Do not rely on color alone to convey status; pair it with text and, when helpful, an icon.
- Keep focus indicators visible and distinct from static borders.

## Contrast

- White on `primary`: 7.74:1.
- White on `primary-dark`: 13.52:1.
- White on `accent`: 2.78:1. Do not use for normal-sized text.
- White on `accent-accessible`: 5.10:1.
- White on `accent-selected`: 9.59:1.
- `text` on white: 12.63:1.
- `text-muted` on white: 4.69:1; do not place it on darker grey surfaces.
- `danger` on white: 4.53:1; supplement with an explicit error label.

## Completion Checklist

- [ ] The correct color-only artifact was copied into the target project.
- [ ] Plain CSS imports `theme.css`, Tailwind v4 imports `tailwind.theme.css`, or Tailwind v3 merges only `tailwind.theme.json` colors.
- [ ] Existing project-specific colors and non-color configuration remain intact.
- [ ] Every edited production line changes only a color value, color token, or color utility.
- [ ] No dark-theme palette, dark-mode toggle, `prefers-color-scheme: dark` rule, or Tailwind `dark:` color utility remains in the changed UI.
- [ ] The changed frontend files were searched for dark-theme remnants and any matches were removed or confirmed unrelated to the rendered UI.
- [ ] Existing default, hover, active, selected, focus, disabled, error, and success states remain distinguishable where present.
- [ ] Each changed tag, badge, or colored control has an explicit foreground token and a contrast-safe background token; selector-level overrides were checked.
- [ ] Changed foreground and background pairs meet the contrast rules above.
- [ ] The project build, relevant tests, and lint/type checks pass.
- [ ] The final diff contains no unrelated layout, behavior, or formatting changes.
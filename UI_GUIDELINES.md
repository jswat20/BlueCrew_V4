# The Slate UI Guidelines

This document records the shared presentation contract currently implemented by the application. It is intentionally incremental: existing feature-specific classes may remain as compatibility hooks, but new or migrated high-traffic controls should use the canonical classes below.

## Controls

Every standard control uses the base `button` class and one variant:

- `button button-primary` — the main forward action in a section.
- `button button-secondary` — supporting and neutral actions.
- `button button-danger` — destructive, rejecting, cancelling, or deleting data.
- `button button-link` — low-emphasis navigation or disclosure.

Use `button-compact` only for concise controls such as named drawer-close buttons. Disabled controls use the native `disabled` attribute. Icon-only controls require an `aria-label` that describes the action.

JavaScript that composes control classes can use `getPresentationButtonClass({ variant, compact, className })` from `js/ui/presentation.js`. Supported variants are `primary`, `secondary`, `destructive`, and `link`.

## Structure

- Page headings: `presentation-page-header` or `renderPageHeader()`.
- Card headings: `presentation-card-header` or `renderCardHeader()`.
- Cards: `presentation-card`.
- Supporting panels: `presentation-panel`.
- Form action rows: `presentation-form-actions`.
- Horizontally contained tables: `presentation-table-wrapper`.

Operations Center may combine these structural contracts with its cockpit-specific classes. Its visual identity should not be flattened into a generic card layout.

## Status and feedback

Use `renderStatusBadge()` with a semantic status. Standard visual groups are:

- Success: `approved`, `filled`, `success`, or `healthy`.
- Attention: `pending`, `warning`, or `watch`.
- Destructive: `open`, `rejected`, `danger`, or `critical`.
- Informational: `info`.
- Neutral: any unspecified status.

Use `renderEmptyState()` for an empty result or workload. It announces politely with `role="status"`. Use `renderErrorState()` for a blocking error; it announces assertively with `role="alert"`. Do not use an error state for ordinary validation hints that are already associated with a form control.

## Accessibility and responsive behavior

- Interactive controls must have an accessible name.
- Keyboard focus must remain visibly distinct; canonical controls use a three-pixel high-contrast focus outline.
- Standard controls have a minimum 44-pixel target. Compact controls are reserved for constrained utility actions.
- Tables must scroll inside `presentation-table-wrapper` rather than widening the page.
- Empty and error feedback must retain its semantic live-region behavior.


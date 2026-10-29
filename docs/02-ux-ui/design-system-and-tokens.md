# Design system and tokens

**Status:** Proposed; requires visual and accessibility validation. **Owner:** Design systems architect. **Related:** all UI features. **Scope:** Semantic tokens, not a fixed visual brand.

| Token | Proposed value/use |
|---|---|
| `space.1/2/3/4/6` | 4/8/12/16/24 CSS px; compact controls may use 4 px internally |
| `radius.control/panel` | 6/12 px; never the sole state cue |
| `type.body` | 16 px default with unitless line-height 1.5; respect browser scaling |
| `type.small` | 14 px minimum for ancillary labels |
| `target.minimum` | 24×24 CSS px minimum where WCAG exceptions do not apply; aim 44×44 for touch |
| `color.text`, `surface`, `border`, `focus`, `danger`, `success` | Semantic roles resolved per theme; verify actual contrast, do not assume palette compliance |
| `motion.fast` | ≤150 ms for nonessential state; disable or reduce with user preference |

Use text plus icon or pattern for status, not color alone. Focus indicator must be visible against every adjacent surface; text and non-text contrast must meet applicable WCAG criteria. Layout uses logical CSS properties, supports 200% text resizing and RTL, and does not mirror media time unless explicitly designed. Tokens are versioned and tested across light/dark/high-contrast modes. Acceptance: sample components pass contrast, keyboard, zoom and reduced-motion review; exact palette remains a design decision rather than an unsupported claim of compliance.

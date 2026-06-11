---
name: BataVasa
description: Calm personal operating system for finance, habits, journals, reminders, and AI insight.
colors:
  primary: "#2F6F73"
  accent: "#C9853E"
  background-primary: "#F7F4EE"
  background-secondary: "#EDE7DC"
  surface-elevated: "#FFFDF8"
  text-primary: "#20201D"
  text-secondary: "#4D493F"
  text-muted: "#6F6A60"
  border-subtle: "#DDD5C8"
  border-card: "#D7CCBA"
  success: "#3E7C59"
  warning: "#B87521"
  danger: "#A33A32"
  info: "#4C6F91"
  finance-expense: "#A33A32"
  finance-income: "#3E7C59"
  module-tasks: "#4C6F91"
  module-habits: "#C9853E"
  module-journal: "#7D5A86"
  module-analysis: "#5E756E"
typography:
  headline:
    fontFamily: "System"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "System"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "System"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "System"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  card:
    backgroundColor: "{colors.surface-elevated}"
    rounded: "{rounded.lg}"
    padding: "16px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-elevated}"
    rounded: "{rounded.full}"
    padding: "12px 16px"
  chip:
    backgroundColor: "{colors.background-secondary}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "8px"
---

# Design System: BataVasa

## 1. Overview

**Creative North Star: "Living Ledger"**

BataVasa is a personal ledger for daily life: finance, habits, reminders, journals, and AI insight appear as entries in one living record. The interface should feel like a structured notebook with intelligence in the margins, not a command dashboard or a generic AI chat surface.

The system favors matte paper surfaces, clear ledger rows, readable entry hierarchy, and compact inline insight. AI output is part of the annotation layer: helpful, specific, and visually quieter than the user's own data. Finance, Habits, Journals, and Reminders should feel like different entry types in one daily book.

**Key Characteristics:**
- Paper-like surfaces with enough contrast for fast mobile scanning.
- Ledger rows over metric dashboards; entries carry the product.
- Warm but not cute; personal but still trustworthy for money.
- Familiar mobile affordances, clear rows, minimum 44pt touch targets.
- Module color acts as an entry marker, not a full-card theme.

## 2. Colors

The palette is restrained and tactile: warm matte neutrals carry most of the screen, deep teal anchors primary actions, and copper marks decisive attention. Module colors are quiet enough to sit together in a mixed daily timeline.

### Primary
- **Ledger Teal** (#2F6F73): Primary actions, active navigation, focus cues, and neutral AI affordances.

### Secondary
- **Copper Note** (#C9853E): Secondary brand accent, used for important decisions, habit energy, and warm highlights.

### Tertiary
- **Module Colors** (#4C6F91, #C9853E, #7D5A86, #5E756E): Reminders, Habits, Journal, and Analysis identity markers. Use them for icons, left markers, small chips, and report legends, not large inactive backgrounds.

### Neutral
- **Ledger Canvas** (#F7F4EE): Main light background.
- **Page Panel** (#EDE7DC): Nested rows, chips, pressed states, and secondary panels.
- **Paper Surface** (#FFFDF8): Cards, sheets, headers, and list containers.
- **Primary Ink** (#20201D): Main text.
- **Secondary Ink** (#4D493F): Supporting body text.
- **Muted Ink** (#6F6A60): Timestamps and metadata, still readable.
- **Subtle Border** (#DDD5C8): Row separation and low-emphasis outlines.

### Named Rules

**The Ledger Marker Rule.** Use small color markers to identify entry type: icon, dot, chip border, or narrow metadata accent. Avoid coloring whole mixed-list cards.

**The Attention Budget Rule.** A screen should have one dominant attention state. If Review Inbox is active, summary chips and secondary actions stay quiet.

## 3. Typography

**Display Font:** System
**Body Font:** System
**Label/Mono Font:** Courier only for rare technical output

**Character:** Compact, readable, and native. BataVasa uses weight, spacing, and entry grouping more than large type to create hierarchy.

### Hierarchy
- **Display** (700, 28-34px, 1.2): Rare app-level moments and major report metrics.
- **Headline** (700, 22px, 1.2): Daily date, screen summaries, and primary metric headings.
- **Title** (600-700, 15-18px, 1.4): Section titles, row titles, and card titles.
- **Body** (400-600, 14px, 1.4): Main row content and explanatory text.
- **Label** (500-600, 12-13px, 1.4): Metadata, chips, badges, timestamps, and compact controls.

### Named Rules

**The Native Scale Rule.** Do not use fluid typography or oversized display text in task surfaces. Product screens should load directly into work.

**The Ledger Title Rule.** Row titles should be short and concrete. Metadata belongs underneath or at the trailing edge, never competing with the entry title.

## 4. Elevation

BataVasa uses tonal layering and thin borders before shadows. Most depth comes from the contrast between ledger canvas, page panel, and paper surface. Shadows are reserved for sheets, floating controls, and overlays.

### Shadow Vocabulary
- **Card Shadow** (`0 1px 3px rgba(0,0,0,0.025)`): Top-level cards on light themes.
- **Dark Card Shadow** (`0 2px 6px rgba(0,0,0,0.28)`): Elevated dark-theme surfaces.
- **Floating Control Shadow** (`0 3px 8px rgba(0,0,0,0.25)`): FABs and temporary controls.

### Named Rules

**The Page Before Shadow Rule.** Prefer page-like surface changes and borders before increasing shadow strength.

## 5. Components

### Buttons
- **Shape:** Round or pill for primary actions (`full`), 44pt minimum touch target.
- **Primary:** Ledger Teal with white icon or text.
- **Hover / Focus:** Pressed state darkens or moves to the secondary surface; focus should be visible through border or color.
- **Secondary / Ghost:** Border or tonal surface, never a decorative gradient.

### Chips
- **Style:** Soft Panel background, compact padding, module icon when the chip identifies a source.
- **State:** Selected filters may use module or brand color at low alpha with strong readable text.

### Cards / Containers
- **Corner Style:** `lg` for top-level cards, `md` for panels, `sm` for rows inside a card.
- **Background:** Paper Surface for top-level cards, Page Panel for nested rows.
- **Shadow Strategy:** Use the shared card shadow through `getCardStyle`.
- **Border:** Card border uses `border.card`; nested rows use `border.subtle`.
- **Internal Padding:** 16px for top-level cards, 8-12px for rows and chips.

### Ledger Rows
- **Shape:** Row-like, not tile-like. Use compact vertical rhythm and stable trailing actions.
- **Markers:** Module icon or small color dot at the leading edge.
- **Metadata:** Date, category, sync/review state, and recurrence sit below the title or at the trailing edge.
- **States:** Review, overdue, skipped, and important states use text plus marker. Color alone is not enough.

### AI Notes
- **Style:** Small annotation panel, usually Page Panel background with a Ledger Teal marker.
- **Position:** Inline near the relevant data, never a full-screen identity.
- **Copy:** Concise, non-judgmental, specific to the user's entries.

### Inputs / Fields
- **Style:** Elevated or secondary background, subtle border, readable placeholder text.
- **Focus:** Primary border or icon color. Avoid large glow.
- **Error / Disabled:** Semantic danger for errors, muted ink and lowered opacity for disabled.

### Navigation
- **Style:** Standard bottom tabs with Feather icons.
- **Active State:** Module tabs may use their module color; the center launcher uses brand primary.
- **Overlay Navigation:** Temporary module selection should appear as a calm bottom panel, not a dramatic radial effect.

## 6. Do's and Don'ts

**Do**
- Keep Home focused on today's decisions, then today's timeline, then secondary actions.
- Use inline AI notes and concise section rendering.
- Keep colors sparse and purposeful.
- Use the same row vocabulary across modules.
- Preserve readable contrast for muted text.
- Prefer ledger rows, page panels, and margin notes over dashboard tiles.

**Don't**
- Do not create landing-page hero sections inside the app.
- Do not use gradient text, decorative glass, glowing orbs, or repeated card grids.
- Do not make AI chat the visual identity of the product.
- Do not use full-saturation module colors for inactive backgrounds.
- Do not add motion that does not communicate state.
- Do not make finance screens look like crypto, banking, or accounting dashboards.

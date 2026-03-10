# Caashflow — Design Token Reference

> Quick reference for building new features. Patterns extracted from the two "gold standard" pages:
> **SaveUp** (savings goals) and **Baseline** (base budget table).

---

## Design Philosophy

- **Cream app background** — never white at the page level
- **Shadow, not border** — cards float on cream with `shadow-card`; avoid `.border` wrappers around cards
- **Pills everywhere** — all buttons are fully rounded (`rounded-full`)
- **Layered cream** → app bg → card bg → modal bg (three distinct cream layers)
- **No table borders** — table rows use alternating `bg-bg-white` / `#E8F5F4` with mint header, no `border` rules

---

## Color Tokens

### Backgrounds (cream layering system)
| Token | Hex | Usage |
|-------|-----|-------|
| `bg-bg-cream` | `#fff7ef` | App background (`body`) |
| `bg-bg-cream-light` | `#fffaf5` | Card backgrounds (lighter cream) |
| `bg-bg-white` | `#ffffff` | Elevated cards, modals, table odd rows |

### Brand
| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` / `bg-primary` | `#0078D0` | Main CTAs, links, active states |
| `text-primary-teal` / `bg-primary-teal` | `#00AD9C` | Footer bar, secondary actions, fund goals |
| `bg-primary-light` | `#1AB5DB` | Hover states |
| `bg-mint` | `#CCE6E3` | Success, savings category |

### Surfaces (badge/pill backgrounds — dark text always)
| Token | Hex | Usage |
|-------|-----|-------|
| `bg-surface-mint` | `#e2f2f1` | Mint-tinted section bg |
| `bg-surface-lavender` | `#dbd4f7` | Lavender tint |
| `bg-surface-pink` | `#f9b8b9` | Pink tint |
| `bg-surface-gray` | `#e9e9e9` | Progress bar tracks |
| `bg-surface-beige` | `#f5f1ed` | Warm neutral tint |

### Text
| Token | Hex | Usage |
|-------|-----|-------|
| `text-text-heading` | `#302d2e` | Headings, dollar amounts |
| `text-text` | `#3F3F3F` | Body text |
| `text-text-muted` | `#8a8a8a` | Labels, de-emphasized |
| `text-text-inverse` | `#ffffff` | Text on teal/dark buttons |

### Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| `text-warning` / `bg-warning` | `#ED6113` | Overdue, error states |
| `text-success` / `bg-success` | `#2e7d32` | Positive states |
| `text-error` | `#d32f2f` | Validation errors |

### Hardcoded values used in components (Baseline table)
| Value | Usage |
|-------|-------|
| `#c9e5e4` | Table `<thead>` background (mint teal) |
| `#E8F5F4` | Table even rows (light mint) |
| `#E1DEEC` | Table row hover (soft lavender) |

---

## Typography

### Fonts
- **Display/Logo:** `font-display` → Passion One (weight 400 only)
- **All UI:** `font-sans` → Inter (400, 500, 600, 700)

### Scale
| Class | Size | Usage |
|-------|------|-------|
| `text-display` | 56px | Watermarks, hero big numbers |
| `text-h1` | 40px | Page headings, stat values |
| `text-h2` | 28px | Section headings, card amounts |
| `text-h3` | 24px | Card titles, subsection headings |
| `text-body` | 20px | Body text (default) |
| `text-label` | 16px | Button labels, small semibold text |
| `text-caption` | 14px | Metadata, table cells, captions |

### Common combos
```
Page heading:     text-h1 font-bold text-text-heading
Section heading:  text-h3 font-bold text-text-heading
Card amount:      text-h2 font-bold text-text-heading
Table header:     text-caption font-bold uppercase text-text-muted
Table cell name:  text-caption font-medium text-text-heading
Table cell value: text-caption font-bold text-text-heading
Muted label:      text-caption text-text-muted
```

---

## Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 8px | Inputs, error banners |
| `rounded-lg` | 16px | Cards, containers |
| `rounded-[24px]` | 24px | Stat cards, hero sections |
| `rounded-full` | 9999px | ALL buttons, pills, tags, avatars |

---

## Shadows
| Token | Value | Usage |
|-------|-------|-------|
| `shadow-card` | `0 12px 24px 0px rgba(110,110,110,0.4)` | Cards floating on cream — the main card shadow |
| `shadow-sm` | subtle | Hover lifts |
| `shadow-md` | medium | Dropdowns, popovers |
| `shadow-lg` | strong | Modals |

---

## Component Patterns

### Card (SaveUp style — no border, shadow floats on cream)
```tsx
<div className="bg-bg-white rounded-lg shadow-card p-6">
  ...
</div>
```

### Summary/Stat Card
```tsx
<div className="bg-bg-white rounded-lg shadow-card p-6">
  <p className="text-caption font-bold uppercase text-text-muted">TOTAL SAVED</p>
  <p className="text-h1 font-bold text-text-heading">$103.00</p>
  <p className="text-caption text-text-muted">across 1 active goal</p>
</div>
```

### Primary Button (teal, pill)
```tsx
<button className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-label font-bold hover:opacity-90 transition-opacity">
  + Add Goal
</button>
```

### Ghost Button (outline, pill)
```tsx
<button className="bg-bg-white text-text-heading border border-border rounded-full px-5 py-2.5 text-label font-bold hover:border-primary transition-colors">
  Reset to Defaults
</button>
```

### Text Link Button (no background)
```tsx
<button className="text-caption text-primary font-semibold hover:underline">Edit</button>
<button className="text-caption text-text-muted hover:text-warning font-semibold transition-colors">Delete</button>
```

### Type Pill / Badge
```tsx
{/* Purchase */}
<span className="text-caption bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">Purchase</span>

{/* Fund */}
<span className="text-caption bg-primary-teal/10 text-primary-teal font-semibold px-2 py-0.5 rounded-full">Fund</span>
```

### Progress Bar
```tsx
{/* Track */}
<div className="w-full bg-surface-gray rounded-full h-3 overflow-hidden">
  {/* Fill */}
  <div className="h-3 rounded-full bg-primary-teal transition-all duration-500" style={{ width: `${pct}%` }} />
</div>
```

### Section Group Header
```tsx
<div className="flex items-center justify-between mb-3">
  <h2 className="text-h3 font-bold text-text-heading">Monthly</h2>
  <span className="text-caption font-bold text-text-muted">$8,796.00</span>
</div>
```

---

## Baseline Table Pattern (borderless, mint header, alternating rows)

```tsx
<div className="rounded-lg overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead className="bg-[#c9e5e4]">
        <tr>
          <th className="text-left text-caption font-bold uppercase text-text-muted px-4 py-3">
            Name
          </th>
          {/* more headers */}
        </tr>
      </thead>
      <tbody>
        <tr className="odd:bg-bg-white even:bg-[#E8F5F4] hover:bg-[#E1DEEC] transition-colors">
          <td className="px-4 py-3 text-caption font-medium text-text-heading">EOS Fitness</td>
          <td className="px-4 py-3 text-caption font-bold text-text-heading">$30.00</td>
          <td className="px-4 py-3 text-caption text-text-muted">22</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

**Key table rules:**
- No `border` classes anywhere on the table
- `thead` = `bg-[#c9e5e4]` (mint teal)
- `odd` rows = `bg-bg-white`, `even` rows = `bg-[#E8F5F4]`
- Hover = `bg-[#E1DEEC]` (soft lavender)
- Cells = `px-4 py-3`, `text-caption`
- Wrap in `rounded-lg overflow-hidden` div — no border on wrapper either

---

## Form Inputs
```tsx
{/* Standard input */}
<input className="w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors" />

{/* Select */}
<select className="w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors" />
```
> Note: Inputs use `border` (unlike cards). `rounded-sm` (8px), not `rounded-full`.

---

## Spacing Reference (8-point grid)
| Value | px |
|-------|----|
| `p-3` / `gap-3` | 12px |
| `p-4` / `gap-4` | 16px |
| `p-5` / `gap-5` | 20px |
| `p-6` / `gap-6` | 24px |
| `p-8` / `gap-8` | 32px |
| `mb-6` | 24px — standard section gap |
| `mb-8` | 32px — standard group gap |

---

## Page Layout Shell
```tsx
<div className="max-w-5xl mx-auto">
  <div className="mb-6">
    <h1 className="text-h1 font-bold text-text-heading">Page Title</h1>
    <p className="text-caption text-text-muted mt-1">Subtitle goes here</p>
  </div>
  {/* content */}
</div>
```

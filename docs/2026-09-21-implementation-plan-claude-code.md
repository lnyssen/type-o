# Generative Typography System — Implementation Plan for Claude Code

**Status:** Ready for Claude Code handoff  
**Created:** 2026-09-21  
**Approved by:** Laurent  
**Design spec:** `2026-09-21-generative-typography-system-design.md`

---

## 🎯 Handoff Brief

Laurent is launching an **open-source generative typography tool** — production-ready fonts from parametric control. Designers, developers, type enthusiasts = audience.

**You own:** entire codebase (frontend + backend) + GitHub repo + UI implementation.

---

## 🎨 Aesthetic Direction (STRICT)

Inspire from **laurentnyssen.be** — match this exactly:
- **Background:** Dark (#1a1a1a–#242424 range)
- **Primary text:** Silver/grey (#e0e0e0–#f0f0f0)
- **Accent color:** Violet (#6b2fd9 or adjacent)
- **Typography:** Large, bold, uppercase headlines; clean sans-serif (system font acceptable)
- **Layout:** Ultra-minimal, high contrast, pill-shaped nav elements, generous whitespace
- **Interaction:** Smooth transitions, no clutter

**Do not deviate.** This is the visual identity.

---

## 🏗️ Architecture (Confirmed)

### Layer 1: Frontend (Browser)
- **Skeleton Editor Canvas:** p5.js + custom control (Edit Mode = drag Bézier nodes; Preview Mode = morphed output)
- **Parameter Sliders:** 8 controls (Weight, Contrast, Terminals, Modulation, Width, Tension, Seed, Serif Mode)
- **Metrics Panel:** Auto + manual fine-tuning (kerning pairs, glyph-level, x-height, ascender/descender)
- **Preview:** Full Latin Extended (200+ glyphs) updating live
- **Export UI:** Select format (.ttf, .otf, .woff) → download or copy link
- **Project Management:** Load/save .typeo files (JSON persistence)

### Layer 2: Generation Engine
- **Skeleton Morphing:** Parameterize Latin Extended characters from base skeleton
- **Auto-Metrics:** Calculate kerning, advance widths, metrics based on skeleton + parameters
- **Metric Overrides:** Per-glyph manual adjustment layer
- **Font Building:** Compile morphed glyphs + metrics → binary font

### Layer 3: Export/Compilation (Backend)
- **Node.js + Express server** receiving glyph data + metrics
- **Python fontTools (via child_process):** Compile binary fonts
- **Return:** .ttf, .otf, .woff files

---

## 📋 Phase 1: Foundation (Frontend Structure)

### 1.1 Project Setup
- [ ] Initialize Node.js + Express backend
- [ ] Set up React or Vanilla JS frontend (whichever aligns with aesthetic)
- [ ] Tailwind CSS (or vanilla CSS) for styling — **match laurentnyssen.be aesthetic strictly**
- [ ] p5.js + custom canvas library for skeleton editor
- [ ] Git repo (public, MIT license)

### 1.2 Layout & Navigation
- [ ] Dark background, 100vh viewport
- [ ] Header: Logo + title (large, bold, uppercase)
- [ ] Left sidebar: mode selector (Skeleton Edit / Parameters / Metrics / Preview / Export)
- [ ] Main canvas area
- [ ] Pill-shaped nav buttons (Edit | Preview | Fine-tune | Export)
- [ ] Footer: GitHub link, license attribution

### 1.3 Theming & Design Tokens
- [ ] Color palette (dark BG, silver text, violet accent)
- [ ] Typography scale (system font, emphasis levels)
- [ ] Spacing system (8px grid)
- [ ] Interactive states (hover, focus, active)

---

## 📋 Phase 2: Skeleton Editor (Frontend + Backend)

### 2.1 Canvas Setup (p5.js)
- [ ] Render a single character (e.g. "A") at large scale on canvas
- [ ] Display skeleton (abstract armature as lines + nodes)
- [ ] Render filled glyph based on skeleton

### 2.2 Edit Mode
- [ ] **Add nodes:** Click on skeleton to insert Bézier control points
- [ ] **Drag nodes:** Move nodes to reshape skeleton in real-time
- [ ] **Delete nodes:** Right-click to remove
- [ ] **Snap-to-grid:** Optional, for precision
- [ ] **Undo/Redo:** Full history
- [ ] **Character selector:** Load different glyphs ("A", "B", "a", "1", etc.)

### 2.3 Skeleton Persistence
- [ ] Store skeleton data in memory (array of nodes per glyph)
- [ ] Save to .typeo project file (JSON format)
- [ ] Load from .typeo file

### 2.4 Glyph Generation Backend
- [ ] Server endpoint: `/api/generate-glyph` → accepts skeleton JSON
- [ ] Skeleton-to-spline conversion (Bézier math)
- [ ] Fill logic (outline → filled glyph)
- [ ] Return rasterized preview (PNG or SVG)

---

## 📋 Phase 3: Parametric Controls (Frontend)

### 3.1 Parameter Sliders (8 core)
- [ ] **Weight (0–100):** Stroke thickness (pre-drawn variations or dynamic scaling)
- [ ] **Contrast (0–100):** Thick/thin ratio per stroke
- [ ] **Terminals:** Dropdown (sharp / rounded / serif)
- [ ] **Modulation (0–100):** Curve sinuosity
- [ ] **Width:** Dropdown (condensed / normal / expanded)
- [ ] **Tension (0–100):** Global energy (curvature aggressiveness)
- [ ] **Seed:** Numeric input (integer for reproducible randomness)
- [ ] **Serif Mode:** Toggle (on/off)

### 3.2 Real-time Preview
- [ ] Live update of **all 200+ Latin Extended glyphs** as sliders change
- [ ] Smooth transitions (0.3s ease-in-out)
- [ ] Performance: debounce slider updates (100ms)

### 3.3 Parameter Presets (Optional v1)
- [ ] Save current slider state as a preset
- [ ] Load preset (overwrites sliders)

---

## 📋 Phase 4: Auto-Metrics & Fine-tuning Panel (Frontend + Backend)

### 4.1 Intelligent Auto-Metrics (Backend)
- [ ] Server endpoint: `/api/calculate-metrics` → accepts glyph data
- [ ] Calculate:
  - **Advance width:** Based on glyph bounding box + margins
  - **Kerning pairs:** Common pairs (AV, To, Ay, etc.) auto-adjusted by skeleton width
  - **Ascender/Descender height:** Fixed, respect typographic standards
  - **x-height:** Standard proportion
- [ ] Return: metrics object (kerning dict, per-glyph metrics)

### 4.2 Manual Fine-tuning UI
- [ ] Toggle: "Auto-metrics" (on/off)
- [ ] When off, show editable table:
  - Kerning pair editor (lookup + numeric adjust)
  - Per-glyph advance width adjust (slider)
  - x-height, ascender, descender (shared sliders)
- [ ] Apply button → recalculate affected glyphs

---

## 📋 Phase 5: Export & Font Compilation (Backend)

### 5.1 Export Endpoint
- [ ] Server endpoint: `/api/export-font` → accepts:
  - Skeleton data (all glyphs)
  - Parameters (weight, contrast, etc.)
  - Metrics (kerning, advance widths)
  - Format (.ttf, .otf, .woff)
- [ ] Validate input (glyphs, metrics, format)
- [ ] Call Python fontTools (via child_process)

### 5.2 Python Font Compilation Script
- [ ] Input: skeleton + metrics JSON
- [ ] Build font object (fontTools.fontBuilder or similar)
- [ ] Add glyphs (spline data from skeleton)
- [ ] Set metrics (kerning, advanceWidth, ascender, descender)
- [ ] Add required tables (name, OS/2, post, hmtx, etc.)
- [ ] Output: .ttf, .otf, or .woff binary file

### 5.3 Frontend Export Flow
- [ ] Select format dropdown (.ttf, .otf, .woff)
- [ ] "Generate & Download" button
- [ ] Show spinner during compilation (2–5s typical)
- [ ] Download file automatically or copy direct link
- [ ] Success toast with font name + format

---

## 📋 Phase 6: Project Persistence (.typeo Files)

### 6.1 .typeo File Format (JSON)
```json
{
  "name": "MyFont",
  "version": "1.0",
  "created": "2026-09-21T12:34:56Z",
  "parameters": {
    "weight": 50,
    "contrast": 60,
    "terminals": "rounded",
    "modulation": 40,
    "width": "normal",
    "tension": 50,
    "seed": 12345,
    "serifMode": false
  },
  "skeletons": {
    "A": [ /* node array */ ],
    "B": [ /* node array */ ],
    ...
  },
  "metrics": {
    "kerning": { "AV": -50, "To": -40, ... },
    "advanceWidths": { "A": 600, "B": 560, ... },
    "xHeight": 500,
    "ascender": 750,
    "descender": -200
  }
}
```

### 6.2 Save / Load UI
- [ ] "Save Project" button → file dialog → download .typeo JSON
- [ ] "Load Project" button → file input → parse + restore all state
- [ ] Current project name in header

---

## 📋 Phase 7: MVP UI Polish & Testing

### 7.1 Responsive Layout
- [ ] Desktop-first (1200px+)
- [ ] Skeleton editor canvas: responsive width
- [ ] Sidebar: collapsible on tablet (not mobile in v1)

### 7.2 Keyboard Shortcuts
- [ ] `Ctrl+S` / `Cmd+S` → Save project
- [ ] `Ctrl+O` / `Cmd+O` → Load project
- [ ] `Ctrl+E` / `Cmd+E` → Export
- [ ] Arrow keys in skeleton editor → fine move selected node

### 7.3 Error Handling
- [ ] Font compilation fails → show error toast + reason
- [ ] Invalid skeleton → validation warning
- [ ] File upload errors → user-friendly message

### 7.4 Testing Checklist
- [ ] Skeleton edit: add/drag/delete nodes smoothly
- [ ] Parameters: all 8 sliders morph preview in real-time
- [ ] Export: .ttf, .otf, .woff each generate valid fonts
- [ ] Open in Adobe, Figma, browser web fonts → renders correctly
- [ ] Save/load .typeo file → perfect round-trip
- [ ] Metrics: auto-calc + manual override both work

---

## 🛠️ Tech Stack (Confirmed)

| Layer | Tech | Role |
|-------|------|------|
| **Frontend** | HTML5 + CSS3 | Structure + styling (match laurentnyssen.be) |
| | React or Vanilla JS | UI state management |
| | p5.js | Canvas + skeleton visualization |
| | Tailwind CSS or vanilla | Responsive layout |
| **Backend** | Node.js + Express | REST API server |
| | Python (child_process) | fontTools font building |
| **Data** | JSON (.typeo) | Project persistence |
| **Repo** | GitHub | Public, MIT license |
| **Deployment** | (TBD) | Vercel, Netlify, or self-hosted |

---

## 📅 Phasings & Dependencies

**Phase 1 (Foundation):** No dependencies → start immediately
**Phase 2 (Skeleton Editor):** Depends on Phase 1 ✓
**Phase 3 (Parameters):** Depends on Phase 2 ✓
**Phase 4 (Metrics):** Depends on Phase 3 ✓
**Phase 5 (Export):** Depends on Phase 4 ✓
**Phase 6 (Persistence):** Can run parallel with Phase 2–5 ✓
**Phase 7 (Polish):** Depends on all above ✓

---

## ✅ Success Criteria

- [ ] UI matches laurentnyssen.be aesthetic (dark, bold, minimal, violet)
- [ ] Skeleton editor: smooth editing of 200+ glyphs
- [ ] Parameters: all 8 sliders update full preview live
- [ ] Export: .ttf, .otf, .woff files generate + open correctly in Adobe, Figma, browsers
- [ ] Metrics: auto-calc + manual override functional
- [ ] Save/load: .typeo files persist + restore perfectly
- [ ] Performance: preview updates within 100ms of slider change
- [ ] Code: clean, documented, open-source ready (MIT)

---

## ⚠️ Known Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Skeleton morphing math complex | Start with 1 glyph (A), scale to 26 letters, then accents |
| fontTools learning curve | Use existing examples / wrappers; consider fontBuilder vs low-level API |
| Real-time preview lag | Debounce slider, cache glyph templates, profile early |
| Browser canvas memory | Cap preview resolution; use Worker threads if needed |
| Metric calculation edge cases | Test kerning on common problematic pairs (AV, Ty, etc.) first |

---

## 🚀 Launch Checklist

- [ ] Repo created (GitHub, MIT license)
- [ ] README.md with usage + screenshots
- [ ] All phases tested + passing
- [ ] Performance profiled (preview update < 100ms)
- [ ] Fonts validated (open in Adobe, Figma, browser)
- [ ] Documentation + inline code comments
- [ ] First release (v1.0) tagged
- [ ] Share with Laurent + get feedback

---

**Next step:** Laurent confirms this plan. Claude Code begins Phase 1.
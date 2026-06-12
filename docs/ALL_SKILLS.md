# Consolidated Skills Reference - Blockchain AI Sentinel

> Auto-generated from 13 skills in the skill library.
> These skills define the design system, code quality, and output standards for this project.

---

## Table of Contents

1. [imagegen-frontend-web](#1-imagegen-frontend-web) — Elite frontend image art direction
2. [high-end-visual-design (soft-skill)](#2-high-end-visual-design) — $150k agency-level UI/UX
3. [full-output-enforcement (output-skill)](#3-full-output-enforcement) — Complete code generation
4. [design-taste-frontend-v1 (taste-skill-v1)](#4-design-taste-frontend-v1) — High-agency frontend
5. [elite-coder (Logistic_AI_SaaS)](#5-elite-coder) — Zero-hallucination coding
6. [brandkit](#6-brandkit) — Premium brand identity generation
7. [brutalist-skill](#7-brutalist-skill) — Industrial brutalism UI
8. [gpt-tasteskill](#8-gpt-tasteskill) — Awwwards-level GSAP motion
9. [image-to-code-skill](#9-image-to-code-skill) — Image-first frontend workflow
10. [imagegen-frontend-mobile](#10-imagegen-frontend-mobile) — Mobile app image generation
11. [minimalist-skill](#11-minimalist-skill) — Premium utilitarian minimalism
12. [redesign-skill](#12-redesign-skill) — Website upgrade protocol
13. [stitch-skill](#13-stitch-skill) — Semantic design system
14. [taste-skill](#14-taste-skill) — Anti-slop frontend (comprehensive)

---

## 1. imagegen-frontend-web

**Purpose:** Generate premium, conversion-aware website design reference images. One horizontal image per section. Enforces composition variety, background-image freedom, and consistent palette.

**Key Rules:**
- **HARD OUTPUT RULE:** Generate ONE separate horizontal image PER section. Never compress multiple sections into one image.
- Default: landing page = 6 sections = 6 images, full website = 8 sections = 8 images
- Hero composition: Avoid default left-text/right-image. Prefer centered, bottom-left, off-grid, or mini minimalist
- **Design Variance:** 8/10, **Visual Density:** 4/10, **Art Direction:** 8/10, **Implementation Clarity:** 9/10
- Theme paradigms: Pristine Light, Deep Dark, Bold Studio Solid, Quiet Premium Neutral
- Background modes: Grid, solid, full-bleed imagery, texture, duotone, cinematic gradient
- Typography: Satoshi-like, Neue-Montreal-like, Cabinet/Clash, Monument, editorial serif+sans, Swiss rational
- Section rhythm: Bento, editorial blocks, poster storytelling, gallery cadence, Swiss grid, asymmetric flow
- CTA variation: Classic pill, outline/ghost, underlined link, banner, oversized headline, caption CTA
- Hero scale: Giant Statement, Mid Editorial, Mini Minimalist
- Narrative spine: Artifact, Journey, Tool, Living System, Stage, Archive
- Anti-AI-slop: No centered sections, no cloned card rows, no purple/blue gradients, no floating blobs

**Brief-to-direction mapping:**
- "minimalist/clean" → Mini Minimalist hero, solid surfaces, stacked center
- "editorial/magazine" → Mid Editorial hero, duotone, off-grid
- "cinematic/premium" → Giant Statement hero, full-bleed with tonal overlay
- "SaaS/product" → Mid Editorial hero, solid + inline asset
- "agency/creative" → Giant OR Mini Minimalist (decisive)
- "e-commerce" → Mid Editorial with strong product focus

---

## 2. high-end-visual-design

**Purpose:** Engineer $150k+ agency-level digital experiences with haptic depth, cinematic spatial rhythm, and flawless fluid motion.

**Core Directive:** NEVER generate the exact same layout/aesthetic twice. Dynamic premium archetypes.

**Absolute Zero (Banned):**
- Fonts: Inter, Roboto, Arial, Open Sans, Helvetica
- Icons: Thick-stroked Lucide, FontAwesome, Material Icons
- Borders/Shadows: Generic 1px solid gray, harsh dark shadows
- Layouts: Edge-to-edge sticky navbars, symmetrical 3-column Bootstrap grids
- Motion: Standard linear/ease-in-out transitions

**Creative Variance Engine:**
- **Vibe Archetypes:** Ethereal Glass (SaaS/AI), Editorial Luxury (Lifestyle/Agency), Soft Structuralism (Consumer/Health)
- **Layout Archetypes:** Asymmetrical Bento, Z-Axis Cascade, Editorial Split
- **Mobile Override:** Any asymmetric layout above `md:` MUST collapse to `w-full`, `px-4`, `py-8` below 768px. Use `min-h-[100dvh]` not `h-screen`.

**Haptic Micro-Aesthetics:**
- **Double-Bezel (Doppelrand):** Nested enclosures — outer shell (subtle bg, hairline border, large radius) + inner core (own bg, inset shadow, smaller radius)
- **Button-in-Button:** Arrow icons nested inside circular wrapper, not naked next to text
- **Spatial Rhythm:** Section padding minimum `py-24`, eyebrow tags as microscopic pills

**Motion Choreography:**
- Custom cubic-bezier: `duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]`
- Fluid Island Nav: Floating glass pill, hamburger morph to X, screen-filling glass overlay, staggered mask reveal
- Magnetic Button: `active:scale-[0.98]`, inner icon diagonal translate
- Scroll Entry: `translate-y-16 blur-md opacity-0` → resolved state over 800ms+
- NEVER use `window.addEventListener('scroll')` — use IntersectionObserver or Framer Motion

**Performance:** Animate only `transform` and `opacity`. `backdrop-blur` only on fixed/sticky elements. Noise on fixed `pointer-events-none` pseudo-elements.

---

## 3. full-output-enforcement

**Purpose:** Override default LLM truncation. Enforce complete code generation, ban placeholders.

**Banned Patterns:**
- Code: `// ...`, `// rest of code`, `// TODO`, `/* ... */`, `// similar to above`
- Prose: "Let me know if you want me to continue", "for brevity", "the rest follows the same pattern"
- Structural: Skeleton when full implementation was requested, skipping middle sections

**Execution Process:**
1. Scope — Count distinct deliverables, lock that number
2. Build — Generate every deliverable completely
3. Cross-check — Compare deliverable count against scope count

**Long Outputs:** Write at full quality to clean breakpoint, then: `[PAUSED — X of Y complete. Send "continue" to resume]`

---

## 4. design-taste-frontend-v1

**Purpose:** High-agency frontend skill with baseline dials and anti-AI-tell enforcement.

**Baseline Dials:**
- DESIGN_VARIANCE: 8 (asymmetric, masonry, CSS Grid fractional units)
- MOTION_INTENSITY: 6 (fluid CSS, cubic-bezier, animation-delay cascades)
- VISUAL_DENSITY: 4 (airy, spacious, expensive feel)

**Default Architecture:**
- React/Next.js, Server Components default
- Tailwind CSS v3/v4 (check version first)
- NO EMOJIS — use Phosphor/Radix icons or SVG
- Use `min-h-[100dvh]` not `h-screen`
- CSS Grid over Flex-Math, `@phosphor-icons/react` or `@radix-ui/react-icons`

**Design Engineering:**
- Typography: `text-4xl md:text-6xl tracking-tighter leading-none`, Geist/Outfit/Cabinet Grotesk/Satoshi
- Serif BANNED for dashboards
- Color: Max 1 accent, saturation < 80%, NO AI Purple/Blue
- Layout: Centered hero BANNED when variance > 4
- Cards: Only when elevation communicates hierarchy
- Forms: Label above input, error text below

**Creative Proactivity:**
- Liquid Glass: `backdrop-blur` + `border-white/10` + `shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`
- Magnetic buttons: Framer Motion `useMotionValue`/`useTransform` outside render cycle
- Perpetual micro-interactions when motion > 5
- Staggered orchestration via `staggerChildren`

**Performance:** Noise on fixed pseudo-elements only. Animate only `transform`/`opacity`. Z-index for systemic layers only.

**AI Tells Banned:** Neon glows, pure black, oversaturated accents, gradient text, custom cursors, Inter font, oversized H1, 3-column equal cards, generic names/avatars, Unsplash links, startup slop names.

---

## 5. elite-coder

**Purpose:** Zero-hallucination coding with defensive programming and self-audit.

**Core Rules:**
1. ANTI-HALLUCINATION: Never invent functions, libraries, or APIs. If unsure, say so.
2. DEFENSIVE PROGRAMMING: Every code has error handling and input validation
3. NO SILENT FAILURES: No empty catch blocks. Errors logged or thrown clearly
4. CLARITY OVER CLEVERNESS: Readable, maintainable code

**Workflow (5 Steps — Never Skip):**
1. **ANALYSIS & EDGE CASES:** Summarize requirement, list 3+ edge cases, ask about libraries
2. **PLANNING:** Write pseudocode/architecture, ask for approval before coding
3. **IMPLEMENTATION:** Full code with brief WHY comments
4. **SELF-AUDIT:** QA review against edge cases, provide unit test examples (Docker-based tests)
5. **FILE EDIT REPORT:** Report exactly which files were edited and what changed

---

## 6. brandkit

**Purpose:** Premium brand-guidelines boards, logo systems, identity decks, visual-world presentations.

**Board Composition (3x3 default):**
1. Logo Cover — Primary mark on brand surface
2. Logo Construction — Clear space, minimum size, grid
3. Digital Application — Favicon, app icon, social
4. Brand Essence — Mood, metaphor, emotional promise
5. Color System — Primary, secondary, accent, neutrals
6. Typography — Display, body, mono
7. Physical Application — Business cards, signage
8. Image Direction — Photography style, treatment
9. System Detail — Spacing, radius, shadow tokens

**Visual Modes:** Dark Developer/Builder, Dark Product/Operator, Dark Nature, Dark Security, Light Editorial, Luxury/Beauty, Voice/Communication, Cultural/Experimental

**Logo Concepts:** Monogram+Meaning, Product Action, Metaphor Fusion, Negative Space, Construction Geometry

---

## 7. brutalalist-skill

**Purpose:** Industrial Brutalism & Tactical Telemetry UI — raw mechanical interfaces.

**Two Archetypes (pick ONE):**
1. **Swiss Industrial Print:** Off-white bg, carbon ink fg, hazard red accent
2. **Tactical Telemetry/CRT Terminal:** Deactivated CRT bg, white phosphor fg, terminal green

**Typography:** Neo-Grotesque macro (massive, tight tracking) + monospace micro (small, generous tracking)

**Layout:** Blueprint Grid, visible borders, 90-degree corners ONLY (no border-radius)

**Components:** ASCII syntax, industrial markers, crosshairs, barcodes, randomized strings

**Effects:** Halftone/1-bit dithering, CRT scanlines, mechanical noise via CSS/SVG filters

---

## 8. gpt-tasteskill

**Purpose:** Awwwards-level design engineering with GSAP motion.

**AIDA Structure:**
- Attention (Hero) → Interest (Bento) → Desire (GSAP Scroll) → Action (Footer)

**Hero Rules:** Ultra-wide containers, H1 max 2-3 lines, buttons with perfect contrast

**Bento Grid:** `grid-flow-dense` mandatory, 3-5 intentional cards

**GSAP Motion:** Hover physics, scroll pinning, image scale/fade, scrubbing text reveals, card stacking

**Bans:** No emojis, no "SECTION 01" labels, no Inter font, no 6-line wrapped headings

---

## 9. image-to-code-skill

**Purpose:** Image-first workflow — generate design images first, analyze deeply, then implement.

**Rules:**
- Mandatory Image-First Rule: Generate images before code
- One large image per section, never compress multiple
- No cropping — generate fresh standalone images
- Deep analysis: text, typography, spacing, buttons, colors, components, layout logic

**Anti-AI-Slop:** No nested boxes, no purple/blue gradients, no generic card spam

---

## 10. imagegen-frontend-mobile

**Purpose:** Premium mobile app screen concepts. Image generation only, no code.

**Platform Modes:** iOS-native premium, Android-native premium, cross-platform neutral

**Rules:**
- Screen-First: One image per requested screen
- Design Bible: Lock consistency across all screens
- Logical Flow: Screens must form believable app flows
- Mockup: Clean phone mockup with visible device border

**Category Bias:** Fintech (trust), Health (calm), Productivity (clarity), Social (media), Commerce (product), Wellness (soft)

---

## 11. minimalist-skill

**Purpose:** Premium Utilitarian Minimalism & Editorial UI.

**Banned:** Inter/Roboto/Open Sans, Lucide/Feather icons, heavy shadows, gradients, emojis, AI copywriting cliches

**Typography:** Geometric sans body, editorial serif headings, monospace code. Extreme contrast.

**Color:** Warm monochrome (white/bone/off-white) with desaturated pastels

**Components:** Asymmetrical bento grids, 1px borders, solid dark CTAs, pill tags, keystroke micro-UIs, faux-OS chrome

**Motion:** IntersectionObserver scroll entry, ultra-subtle hover, staggered reveals, background ambient

**Execution:** Massive vertical padding, max-w-4xl/5xl, strict 1px borders

---

## 12. redesign-skill

**Purpose:** Upgrade existing websites/apps to premium quality.

**Workflow:** Scan (framework/styling) → Diagnose (audit patterns) → Fix (targeted upgrades)

**Audits:**
- Typography: Replace defaults, add Geist/Outfit/Cabinet Grotesk
- Color: Replace pure black, desaturate accents, remove purple/blue AI gradients
- Layout: Break center-symmetry, CSS Grid, max-width, increase spacing
- Interactivity: Hover/active/focus states, loading/empty/error states
- Content: Replace fake names, AI copywriting, lorem ipsum
- Components: Replace generic cards, pill badges, standard carousels
- Code Quality: Semantic HTML, no inline styles, proper meta tags

**Upgrade Techniques:** Variable font animation, broken grid, parallax card stacks, scroll-driven reveals, true glassmorphism, spotlight borders

**Priority:** Font swap → Color cleanup → Hover states → Layout/spacing → Component replacement → States → Polish

---

## 13. stitch-skill

**Purpose:** Semantic Design System Skill for Google Stitch screen generation.

**Key Principles:**
- Atmosphere: Density, variance, motion intensity scales
- Color: Max 1 accent, no AI purple/neon, no pure black
- Typography: Track-tight display, relaxed body, Inter banned, serif banned in dashboards
- Hero: Inline image typography, no overlapping, asymmetric structure
- Components: Tactile push feedback, tinted card shadows, skeletal loaders
- Responsive: Mobile-first collapse, 44px touch targets, typography via clamp()
- Motion: Spring physics (stiffness:100, damping:20), perpetual micro-interactions

---

## 14. taste-skill

**Purpose:** Comprehensive anti-slop frontend for landing pages, portfolios, redesigns.

**Three Dials:** DESIGN_VARIANCE (8), MOTION_INTENSITY (6), VISUAL_DENSITY (4)

**Design System Map:** Official packages (Fluent, Material, Carbon, Polaris) mapped to brief types

**Default Architecture:** React/Next.js, Tailwind v4, Framer Motion, next/font, Zustand/Jotai

**Typography:**
- Display: `text-4xl md:text-6xl tracking-tighter leading-none`
- Serif: Very discouraged by default, banned in dashboards
- Italic descender clearance

**Color:**
- Max 1 accent, LILA RULE (no AI purple default)
- No premium-consumer palette ban (no default beige+brass)

**Layout:**
- Hero fits viewport, max 2 headline lines, 4-element hero stack cap
- Eyebrow restraint (max 1 per 3 sections), zigzag alternation cap

**Image Strategy:** Image-gen tool first, Picsum-seed second, real SVG logos, no div-based fake screenshots

**AI Tells Banned:** Em-dash ban, version labels, section-numbering eyebrows, locale strips, scroll cues, decorative dots

**Motion:** Sticky-stack and horizontal-pan canonical skeletons, scroll-reveal staggering

**Performance:** Hardware acceleration, reduced motion compliance, dark mode, Core Web Vitals

**Redesign Protocol:** Detect mode, audit before touching, preservation rules, modernization levers

**Pre-Flight:** 50+ item checklist covering every anti-pattern

---

## Quick Reference: Which Skill for What?

| Task | Primary Skill | Supporting Skills |
|------|---------------|-------------------|
| Generate website design images | imagegen-frontend-web | brandkit, image-to-code-skill |
| Build premium frontend code | taste-skill, design-taste-frontend-v1 | high-end-visual-design, minimalist-skill |
| Generate mobile app screens | imagegen-frontend-mobile | brandkit, stitch-skill |
| Redesign existing website | redesign-skill | taste-skill, high-end-visual-design |
| Write backend/business logic | elite-coder | full-output-enforcement |
| Create brand identity | brandkit | imagegen-frontend-web |
| Implement GSAP animations | gpt-tasteskill | design-taste-frontend-v1 |
| Generate brutalist/industrial UI | brutalalist-skill | minimalist-skill |
| Convert images to code | image-to-code-skill | imagegen-frontend-web |
| Enforce complete output | full-output-enforcement | elite-coder |
| Generate design system docs | stitch-skill | taste-skill, design-taste-frontend-v1 |

---

*Document generated from 13 skills in `C:\Users\Ngoc Tan\Downloads\skill\`*
*Total skill lines analyzed: ~6,800+*

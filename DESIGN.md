---
name: Technical Minimalist
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#20201f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#e2bfb0'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#a98a7d'
  outline-variant: '#5a4136'
  surface-tint: '#ffb693'
  primary: '#ffb693'
  on-primary: '#561f00'
  primary-container: '#ff6b00'
  on-primary-container: '#572000'
  inverse-primary: '#a04100'
  secondary: '#c8c6c2'
  on-secondary: '#31302d'
  secondary-container: '#474743'
  on-secondary-container: '#b7b5b0'
  tertiary: '#c7c6c6'
  on-tertiary: '#303031'
  tertiary-container: '#999999'
  on-tertiary-container: '#313131'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb693'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7a3000'
  secondary-fixed: '#e5e2dd'
  secondary-fixed-dim: '#c8c6c2'
  on-secondary-fixed: '#1c1c19'
  on-secondary-fixed-variant: '#474743'
  tertiary-fixed: '#e3e2e2'
  tertiary-fixed-dim: '#c7c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#464747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 4rem
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 2.5rem
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  body-md:
    fontFamily: Manrope
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  label-mono:
    fontFamily: Space Grotesk
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1200px
  gutter: 2rem
  section-gap: 8rem
  stack-sm: 0.5rem
  stack-md: 1.5rem
  stack-lg: 3rem
---

## Brand & Style

This design system is built for the modern software engineer who values precision, clarity, and intentionality. The aesthetic is rooted in **Minimalism** with a heavy influence from editorial design and technical documentation. It avoids unnecessary decoration, instead using generous whitespace and rigid structural alignment to signal professional maturity.

The brand personality is "Quietly Confident"—it doesn't need to shout to be noticed. It evokes a sense of calm, high-performance capability through high-contrast typography and a restrained color application. The user experience should feel fast, lightweight, and intellectually honest.

## Colors

The palette is anchored by a deep charcoal (`#1A1A1A`) used as the primary canvas to reduce eye strain and provide a sophisticated backdrop. The primary accent is a vibrant, high-energy orange (`#FF6B00`), used sparingly to highlight critical actions and technical status indicators.

Supporting neutrals include a "Paper" off-white (`#F8F5F0`) for primary text to avoid the harshness of pure white, and a medium gray (`#737373`) for secondary metadata. Borders and subtle surface divisions utilize a low-contrast light gray (`#E5E5E5`) at reduced opacities to maintain the minimalist structure without breaking the visual flow.

## Typography

This design system utilizes a dual-typeface approach to balance technical precision with readability. **Space Grotesk** serves as the headline and label font; its geometric apertures and technical quirks reflect the world of code and engineering. It is used in larger scales with tight letter-spacing for a bold, editorial look.

**Manrope** is used for all body copy. It provides a highly legible, modern sans-serif experience that remains neutral and professional, ensuring that long-form project descriptions or blog posts are comfortable to read. All "mono-style" labels should use Space Grotesk to maintain brand consistency while hinting at a developer's environment.

## Layout & Spacing

The layout follows a **Fixed Grid** model centered on the screen, creating a focused reading experience. It utilizes a 12-column system with generous 2rem gutters. A signature element of this design system is "The Breath"—large vertical gaps (8rem+) between major sections to prevent information density from feeling overwhelming.

Margins should be strictly adhered to, with content often offset to the right (leaving the first 3-4 columns empty) in hero sections to create an asymmetric, modern feel. All components follow an 8px spacing scale to ensure mathematical harmony.

## Elevation & Depth

Depth is achieved through **Tonal Layering** and **Low-Contrast Outlines** rather than traditional shadows. In the dark mode environment, surfaces are separated by subtle shifts in background color (e.g., `#1A1A1A` for the page and `#242424` for cards).

Borders are the primary tool for definition. Use 1px solid borders at 10% opacity for inactive states, increasing to 40% or switching to the primary accent color on hover. This keeps the interface feeling flat, fast, and physically grounded in the "screen" rather than trying to mimic the physical world.

## Shapes

The design system employs a **Soft** shape language. While the overall vibe is rigid and structured, 0.25rem (4px) corner radii are applied to buttons, cards, and input fields to take the "edge" off the technical aesthetic and make the interface feel approachable.

Larger containers, such as project image wrappers, may use `rounded-lg` (8px) to emphasize their role as distinct content blocks. Interactive elements like "pills" or tags should remain slightly rectangular to avoid a "bubbly" appearance that would conflict with the minimalist tone.

## Components

### Hero Section
The hero should feature a `headline-xl` greeting. Use a split-screen layout where the text occupies the left 8 columns and a subtle, monochromatic background graphic or empty space occupies the right. Include a single primary button with a ghost-style secondary link.

### Project Cards
Cards are defined by their simplicity. They should feature a full-bleed image with an 8px radius, followed by a `label-mono` category tag in the primary accent color. The title should be `headline-lg` (scaled down) with a short `body-md` description. Hover states should trigger a subtle scale-up of the image and a border-color shift.

### Buttons
- **Primary:** Solid `#F8F5F0` background with `#1A1A1A` text. No rounded-pill shapes; stick to the `rounded-sm` (4px) standard.
- **Secondary:** Ghost style (transparent background, 1px border) with an arrow icon (→) that animates on hover.

### Contact Information
The contact section should be treated as a footer-level priority. Use a large, "loud" call to action followed by a clean list of links. Social links should use `label-mono` with no icons, relying on typography alone to convey the link's destination. Use high-contrast transitions for hover states (turning the text to the primary accent color).

### Chips & Tags
Technical tags (e.g., "React", "TypeScript") should be styled with a low-contrast background (`#242424`) and small `label-mono` text. They should be strictly rectangular with a 2px radius.
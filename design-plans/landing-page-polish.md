# Landing Page Visual Consistency & Layout Polish

Written against: local working tree

## Evidence chain

- Surface: `Feasify/src/Auth.tsx` (Landing & Login desktop and mobile viewports)
- Problem: Double conflicting hexagon background patterns, brand logo negative margin hack causing top clipping and layout instability, oversized institutional logos causing vertical displacement, stark unstyled black header typography, and disabled-looking input field styling (`bg-gray-100`).
- Design evidence: `Feasify/public/BG.1.png`, `Feasify/src/ResetPassword.tsx`, `Feasify/src/index.css`
- Owner: `Feasify/src/Auth.tsx`
- Scope and affected surfaces: `Feasify/src/Auth.tsx`
- Uncertainty: none

## Design decision

Bring `Auth.tsx` into strict alignment with the existing asset `BG.1.png` and sibling auth pattern in `ResetPassword.tsx`:
1. Remove the duplicate inline SVG hexagon pattern to let `BG.1.png` render cleanly without moiré distortion.
2. Clean up the left brand logo rendering by eliminating `marginTop: "-160px"` and using a properly proportioned container and height bounds.
3. Align the institutional seals in the right pane to `h-16 w-16` (with `sm:h-18 sm:w-18`), change university header to `text-slate-700 font-bold uppercase tracking-[0.25em] mb-6`, and refresh the input fields to crisp `bg-white border-slate-300 focus:border-[#0f4d96]` with balanced label gaps.

## Reuse

- Institutional seal styling pattern and card treatment from `ResetPassword.tsx` (`h-14`–`h-16`, `border-gray-200 bg-white p-1 rounded-full shadow-md`).
- Primary blue action color token `#0f4d96` and hover `#0a3a7a`.
- Brand gold `#c9a654` for visual balance.
- Exemplar: `Feasify/src/ResetPassword.tsx`

## Changes

1. `Feasify/src/Auth.tsx`
   - Change: Remove redundant inline SVG `<pattern id="hexPattern">` from the right-hand column.
   - Change: Stabilize desktop brand logo container on the left column, eliminating fragile negative margin inline style.
   - Change: Reduce institutional logo sizes to `h-16 w-16` / `min-[764px]:h-20 min-[764px]:w-20` with `shadow-md rounded-full bg-white p-1 border border-gray-200` and normalize margins (`mb-5` below logos, `mb-6` below title).
   - Change: Update university title text color to `text-slate-700` (desktop) and `text-white/90` (mobile), matching `ResetPassword.tsx`.
   - Change: Update card input fields from `bg-gray-100 border-gray-300` to clean `bg-white border-slate-300 focus:bg-white focus:border-[#0f4d96] focus:ring-2 focus:ring-blue-100/60` and normalize label margin to `mb-2`.
   - Change: Format "Forgot Password?" button as `text-xs font-semibold text-[#0f4d96] hover:text-[#0a3a7a] hover:underline transition`.
   - Preserve: Authentication logic, Firebase query handlers, error handling, password reveal toggle, and form validation.
   - Verify: Visually harmonious landing page matching the screenshot with no duplicate hexagon artifacts, proper logo framing, and vertically centered login card.

## Scope

- Inherit: Users navigating to `/` (the authentication/landing route).
- Verify: Mobile (`< 764px`), tablet (`764px - 1130px`), and desktop (`>= 1131px`) viewports.
- Exclude: Modal sub-flows (Forgot Password, Verify Code) whose internal forms already function correctly.

## Validation

- Product: Users can view the landing page with crisp, professional layout and submit credentials to log in.
- Interface: Test desktop, tablet, and mobile views to ensure clean alignment and absence of double-pattern noise.
- System: Clean reuse of existing assets (`BG.1.png`, `Logo w Name.png`, `Caba Logo.png`, `fm.jpg`, `plv.jpg`).
- Repository: `npm run build` or Vite build check to verify syntax and bundle integrity.

## Stop conditions

- Stop if existing auth state machine or Firebase login methods are affected.

## Status

- **Status**: Completed & Verified (`vite build` exit code 0).

## Design documentation

- After acceptance and validation: 
  - Brand header height containment: `h-16 overflow-hidden` with `h-44 -my-14 -ml-4` for `Logo w Name.png`.
  - Feature highlights: `max-w-xl` with high-contrast badge in `#c9a654` and `bg-white/5 border border-white/10` cards for optimal legibility over dark backgrounds.
  - Institutional seals: `h-16 w-16 sm:h-20 sm:w-20 rounded-full border-2 border-white bg-white p-1.5 shadow-lg`.
  - Auth card sizing: `max-w-[480px] lg:max-w-[500px]`, `rounded-2xl bg-white/95 backdrop-blur-md p-7 sm:p-9`.
  - Color tokens: Primary navy `#0f4d96`, header navy `#122244`, brand gold `#c9a654`.


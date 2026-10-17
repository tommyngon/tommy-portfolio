# Redesign spec — design language after bulbs.simondupety.com (APPROVED)

Full measured inventory: ref/inventory.md (56 rows). Screenshots: ref/*.png. This file is the
shared brief for all build agents. Do not re-crawl the reference. Write all code from scratch;
copy nothing (code, shaders, sounds, fonts, images, text) from the reference.

## A. Final element list (consolidated from the inventory)
| # | element | reference behaviour | technique | decision |
|---|---|---|---|---|
| 1 | Preloader | white overlay ~3.1 s; column of 5 project thumbnails while loading; "click to enable sound" (desktop) | JS timeline | BUILD (own thumbnails; skippable, skipped on reduced motion / repeat visit) |
| 2 | Hero text reveal | short serif caps lines revealed in line masks, chars stepped in ~4.5 s after load | split lines/words/chars, transform + clip | BUILD |
| 3 | Fixed header | tiny uppercase grotesk: logo (2 lines) left, SOUND, PRICE LIST centre, ABOUT/CONTACT right | fixed, 76 px / 56 px mobile | BUILD with own items |
| 4 | Smooth scroll | eased wheel scroll; mobile scrolls inside main | Lenis | BUILD (lenis, MIT, ~10 kB) |
| 5 | WebGL image column | one centred column of photos (~30% width), rendered in WebGL with curved/warped edges that bend with scroll | WebGL2 plane mesh + vertex bend by scroll velocity | BUILD AS OWN VARIATION: "seam bend" — planes bend like cloth along a vertical seam, ties to söm (signature element; avoid a 1:1 copy) |
| 6 | Text scramble | lists/headings resolve from random glyphs | custom element | BUILD |
| 7 | Project index list | 20 product names as small links near top, each to a product page | static list + scramble | BUILD (my projects + söm pieces) |
| 8 | Image fades | img opacity 700 ms cubic-bezier(.645,.045,.355,1) | CSS | BUILD |
| 9 | Project page | serif caps title top-left of content, spec list (Type/Width/…) in columns; ← BACK left; price + maker bottom-left; 3-column photo row at bottom; one screen on desktop | CSS grid | BUILD (spec rows become Role/Year/Tools/Status; price line becomes a one-line outcome/link) |
| 10 | Contact | header CONTACT opens native dialog: dark overlay rgba(0,0,0,.7), white panel max 60rem, padding 3rem, form name/email/message | <dialog> | BUILD as mailto-based dialog (no form backend = no paid service) |
| 11 | Sound | SOUND toggle (desktop), muted by default, Web Audio; no files loaded | Web Audio synthesis | BUILD original generative ambience + soft interaction ticks |
| 12 | Page transitions | client-side swap ~1.1 s, no overlay measured | router + JS | BUILD: content fades/lines retract 400 ms, next page lines rise 700 ms |
| 13 | About page | tall single photo column (warped), caption bottom-right | same stack | BUILD with my content |
| 14 | Footer | address, email, phone, IG, credit — plain small text | static | BUILD in existing black sign-off band? → ask |
| 15 | Cursor | native | — | SKIP (reference has none) |
| 16 | Hovers | none measurable | — | Keep minimal: underline draw-in already in my system |
| 17 | Mobile menu | none; inline header links | — | BUILD same |
| 18 | Analytics / CMS | Umami, Prismic | — | SKIP (not needed) |

## B. Owner decisions & mapping
- Goal: as close as possible to the reference in look, layout, motion and sound behaviour (owner will customise later). Own code, own words, own generated sounds. Fonts: Special Gothic (same as reference, OFL) + Libre Caslon Text (stand-in for paid Big Caslon).
- Landing = ONLY the first paper sheet at "/" (src/app/page.tsx top section). It must look and behave exactly as now. Everything below it (QBIKK, academy, söm, black sign-off band) moves to the studio pages.
- Routes (all inside the route group src/app/(studio)/, root element .studio):
  /work — index (reference home): preloader, hero lines, small project index list (scramble), centred seam-bend image column of all project images (lib/work.ts COLUMN), footer.
  /work/[slug] — project page (reference product page): caps serif title; spec columns (label: value); ← BACK (to /work); bottom-left outcome + credit lines; row of 3 images; one screen on desktop. Below the first screen, the project's existing interactive piece: qbikk → existing QbikkSection; tomatosharp → existing AcademyFront; som → existing UniformCover (vintage sheet) + link to the catalogue.
  /about — reference about: tall centred photo column (seam bend) of the 4 portraits /portrait/*.webp, a short bio in the hero-line style, caption bottom-right "PORTRAITS — TOMMY NGO NGUYEN", selected work list.
  /uniform — the söm catalogue, restyled into the studio language (keep its 9 plates).
- Header (all studio pages): left "TOMMY NGO NGUYEN" 2 lines (link /); SOUND toggle; right WORK (/work), ABOUT (/about), CONTACT (opens dialog). No price list/CV.
- Contact dialog: overlay var(--c-overlay); white panel max 60rem, padding 3rem; email tommy.nn99@gmail.com, Instagram, LinkedIn (lib/site.ts); a name/email/message form whose Send opens mailto: with the fields (no backend).
- Landing → studio: the landing's OverviewMenu items link to /work/qbikk, /work/tomatosharp, /work/som; the landing "about" link → /about. The transition into a studio page = the studio preloader/intro sequence.
- Sound: original Web Audio synthesis only (no files). Muted until the visitor enables it (SOUND toggle; desktop also shows a "click to enable sound" line in the preloader). Soft warm ambient drone/pad (low gain, slow movement) + soft ticks: when scramble text resolves, on page transitions, dialog open. Persist the choice in localStorage (try/catch).

## D. File ownership (each agent edits ONLY its files; interfaces are fixed — keep signatures)
- Opus (done): components/studio/fonts.ts, tokens.css, lib/work.ts, this spec.
- A (global systems): src/app/(studio)/layout.tsx; components/studio/SmoothScroll.tsx, Header.tsx, Preloader.tsx, PageTransition.tsx, ContactDialog.tsx, shell.module.css.
- B (sections & reveals): components/studio/Scramble.tsx, RevealLines.tsx, sections.module.css; src/app/(studio)/work/page.tsx; src/app/(studio)/about/page.tsx (move the old src/app/about out of the way: delete src/app/about/*).
- C (WebGL & sound): components/studio/SeamColumn.tsx (+ any gl helpers under components/studio/gl/), sound.ts, SoundToggle.tsx.
- D (project pages & content): src/app/(studio)/work/[slug]/page.tsx (+ project.module.css); src/app/uniform → move to src/app/(studio)/uniform/ restyled; src/app/page.tsx (remove QbikkSection/AcademyFront/UniformCover/SiteFooter from the landing; keep the first sheet byte-for-byte otherwise); components/OverviewMenu.tsx hrefs; landing "about" href stays /about.
Interfaces: SeamColumn({items:{src,alt,href}[], className?}); playSound(kind?:"tick"|"page"|"open"); SoundToggle({className?}); Scramble({text,className?,delay?}); RevealLines({lines:string[],className?,delay?}).

## E. Done criteria per agent
npx tsc --noEmit and npx eslint <own files> pass; no edits outside owned files; reduced-motion fallback; keyboard focus visible; commit on your own branch with a clear message; reply ≤150 words + changed paths.

## C. Tokens (draft)
- Colour: paper #F1EEE9 (bg), ink #111111 (text), muted #8A837A, overlay rgba(17,17,17,.7), hairline rgba(17,17,17,.12). Reference uses pure white/black; we use the landing page's paper/ink so the brand carries across.
- Fonts: titles = Instrument Serif, UPPERCASE, 14–15 px, tracking .01em (role of the reference's Big Caslon caps); UI/body = Geist 500 UPPERCASE 12/18 for nav, Geist 400 16/24 body (role of Special Gothic). Both OFL, already in the project.
- Type scale (px): 11, 12, 14, 16, 24 (mobile 11, 12, 13, 15, 20). Line-heights 1.2–1.5.
- Spacing: 4-pt base; page gutter 20 px (mobile 16); header 76/56 px; image column width 30vw (mobile 70vw); column gap 20 px.
- Radius: 0 everywhere.
- Motion: ease = cubic-bezier(.645,.045,.355,1); fast 300 ms (dialog), base 400 ms (transform), slow 700 ms (opacity/reveals); preloader total ≈ 3.0 s; hero reveal starts ≈ 0.4 s after preloader ends, line stagger 80 ms; Lenis lerp 0.1, wheelMultiplier 1.

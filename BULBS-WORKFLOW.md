# Workflow: rebuilding the bulbs.simondupety.com feel in VS Code

Goal: get the studio pages (everything except the landing sheet) as close as possible to
https://bulbs.simondupety.com/, then make it your own. This file is your playbook — follow
the phases in order. Copy the prompts in quotes straight into the Claude panel.

You are on branch `bulbs-rebuild` in `~/tommy-portfolio-site`. `main` and
`redesign/design-language` are untouched, so you can always throw this branch away.

---

## Phase 0 — Setup (once, ~15 min)

1. Open the folder: VS Code → File → Open Folder → `~/tommy-portfolio-site`.
2. Install the extension: Extensions (Cmd+Shift+X) → "Claude Code" (by Anthropic) → sign in.
3. Give Claude a browser. In VS Code's terminal (Ctrl+`):
   ```bash
   claude mcp add playwright -- npx @playwright/mcp@latest
   ```
   Reload the Claude panel. Optional: also install Claude in Chrome
   (https://chromewebstore.google.com/detail/fcoeoabgfenejglbffodgkkbkcdhcgfn) if you want
   to watch Claude drive your own Chrome.
4. Start the site in a second terminal and leave it running:
   ```bash
   npm run dev
   ```
   → http://localhost:3000 (landing) and http://localhost:3000/work (studio pages).
5. Check it works — ask Claude:
   > "Use the browser tool to open https://bulbs.simondupety.com/ and http://localhost:3000/work, take a screenshot of each and show me."

---

## Phase 1 — Your eye first (~20 min, you)

This step matters most. Automated capture can't feel motion; you can.

1. On a Mac, press **Cmd+Shift+5 → Record Selected Portion**, and record yourself using
   bulbs.simondupety.com for 30–60 s: the intro, a slow scroll, a fast scroll, opening a
   product, going back, the sound toggle. Save it into `~/tommy-portfolio-site/reference/`
   (create the folder).
2. Write 5–10 lines in `reference/notes.md` — what you love, in your words. E.g.
   "the images bend like paper when I scroll fast", "the text resolves letter by letter",
   "the click sound is soft and dry". Rank them: most important first.

You'll give Claude these two files in every phase.

---

## Phase 2 — Decide the starting point (5 min)

Ask Claude:
> "Read reference/notes.md. Compare the current /work page with the reference. Is it faster to fix this redesign or to rebuild the studio pages from scratch? Give me a one-paragraph recommendation."

- **Fix** → stay on `bulbs-rebuild` (it already has project pages, data, sound and shell).
- **Rebuild** → `git switch -c bulbs-fresh main` and ask Claude to rebuild only the studio
  pages, keeping the landing sheet from `redesign/design-language`.

Recommended: fix. The structure (pages, data, header, contact) is fine; what's off is the
feel — and the feel is what the loop below fixes.

---

## Phase 3 — The tight loop (most of the work; repeat per element)

Work ONE element at a time, in this order (biggest impact first):

1. Scroll feel (smoothness, inertia)
2. Image warp / bend while scrolling
3. Image column size, spacing and position
4. Preloader + intro timing
5. Text reveals and the scramble
6. Typography (sizes, spacing, line breaks)
7. Project page layout
8. Page transitions
9. Sound (ambience and ticks)
10. Contact dialog, footer, mobile

For each element, use this prompt (change the element name):
> "Element: IMAGE WARP. Open https://bulbs.simondupety.com/ and http://localhost:3000/work at 1440×900. Scroll both slowly, then fast, and take screenshots at the same moments (0%, 10%, 20%, 30%), plus a short series during a fast scroll. Put them side by side. List the 3 biggest differences in this element only, fix the biggest one, then repeat the comparison. Stop after 3 rounds and show me the before/after pairs. Don't copy the reference's code, shaders, images, fonts or sounds — rebuild the behaviour from scratch."

Your job in each round:
- Look at the side-by-side images and at your own screen (scroll it yourself!).
- Answer in one line: "closer / not yet — the bend should start sooner and be softer".
- When it feels right: ask Claude to commit
  > "Commit this with a message describing the change."

Tips:
- Small, specific feedback beats long feedback. "Softer, slower to settle" works.
- If a round makes it worse: "Undo the last change" (it's all in git).
- Sound can't be judged from screenshots — listen and describe ("warmer, quieter, fewer ticks").
- Every ~3 elements, ask: "Show the whole /work page and one project page side by side with the reference on desktop and mobile."

---

## Phase 4 — Check quality (30 min, after the 10 elements)

> "Run a quality pass: npx tsc --noEmit, npx eslint src, check every page loads without console errors on desktop and mobile, keyboard focus is visible, reduced-motion works, and images aren't oversized. Report problems, then fix them one by one."

Also open the site yourself in Safari and Firefox.

---

## Phase 5 — Make it yours (ongoing)

Only once it feels close. One change at a time, same loop, but now the reference is your taste:
- Swap in your own colours (or keep the paper/ink), real söm garment photos (put them in
  `public/work/` and update `src/lib/work.ts`), your own words.
- Twist one signature element so it's recognisably you (e.g. the seam bend, the sound palette).
- Keep a `reference/taste.md` — sites, screenshots and notes you like. Feed it to Claude.

Before publishing: make sure it no longer looks like a copy of bulbs.simondupety.com —
that design belongs to its author.

---

## Phase 6 — Save and publish

- Commit often (Phase 3). Push your branch to GitHub when you're happy:
  > "Push branch bulbs-rebuild to GitHub (not main)."
- Vercel gives that branch a preview link. Merge into `main` only when you want it live.

---

## Where things are
- Pages: `src/app/(studio)/work`, `work/[slug]`, `about`, `uniform`. Landing: `src/app/page.tsx`.
- Shared shell (header, scroll, preloader, transitions, contact): `src/components/studio/`.
- Image warp: `src/components/studio/SeamColumn.tsx` + `gl/seam.ts`. Sound: `sound.ts`.
- Colours, fonts, motion timings: `src/components/studio/tokens.css`, `fonts.ts`.
- Project facts and images: `src/lib/work.ts`, `public/work/`.
- Original spec: `docs-redesign-spec.md`.

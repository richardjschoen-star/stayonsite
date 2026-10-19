# StayonSite

Marketing site for StayonSite, an AI software studio. React 19 + Vite + Tailwind v4, built on [BoardUI](https://www.boardui.com) free components.

```sh
npm install
npm run dev     # http://localhost:5173
npm run build
```

- `src/App.tsx`: nav, hero, ⌘K menu, client login, footer
- `src/console.tsx`: the hero console (sidebar, stats, live agent run, runs table)
- `src/capabilities.tsx`: the interactive service tiles
- `src/sections.tsx`: work, process, pricing, testimonial, FAQ, contact
- `src/globe.tsx`: dot globe (Natural Earth land mask)
- `styles/brand.css`: the brand layer over BoardUI tokens (blue + the mark's yellow, Instrument Sans)
- `components/`, `styles/theme.css`, `styles/typography.css`: BoardUI source, installed with `npx boardui@latest add <name>`

The contact form and client login are front-end only; wire them to a backend before launch.

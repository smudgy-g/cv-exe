# Link to the author's website from every page

### Outcome

A footer at the bottom of every page, below the main content, with a single link to
https://adamgriff.dev reading "Built by SmungyG with love". It opens in a new tab.

The app has no footer today. `src/routes/+layout.svelte` is where it belongs, so every route gets it,
signed in or not. The label is translated like all other text in the app: add a key to `TRANSLATIONS`
in `src/lib/i18n.svelte.ts` with a French and an English string, and render it with `t(...)`.

### Acceptance

- Every page shows the footer, signed out as well as signed in.
- The link points at https://adamgriff.dev, opens in a new tab, and carries `rel="noreferrer"`.
- The label reads "Built by SmungyG with love" in English, and its French equivalent when FR is selected.
- It does not cover content on a phone, and it never appears in the printed CV or cover letter (the `#print`
  element and the print stylesheet).
- `pnpm run check` and `pnpm test` pass.

### Lane

fast lane

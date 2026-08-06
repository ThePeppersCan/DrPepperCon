REPO COMPANY - Quidditch Jenny/name clipping fix

Changed file:
- script.js

Fix:
- Quidditch team-sheet rows now always reserve the pet-art column, even when a pet has no available image.
- This prevents names such as Jenny from being squeezed into the tiny image column and displayed as "Je...".
- Applies to both the normal Quidditch team sheet and the live/synchronised version used by Repo Sports.
- Adds a title tooltip with the full pet name as an extra fallback.

Install:
1. Extract into your website root and overwrite script.js.
2. Push to GitHub / let Cloudflare deploy.
3. Hard refresh with Ctrl+F5.

No Supabase SQL is required.

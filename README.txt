Repo Company — Binder Icon + Favourite Card Watchcard Patch

1. Run quidditch-tcg-favourite-card.sql once in Supabase -> SQL Editor.
2. Replace index.html and script.js in the website root.
3. Upload assets/quidditch-tcg-binder/binder-nav-icon.png if it is not already present.
4. Hard-refresh the site with Ctrl+F5.

Changes:
- Removes all visible square/button chrome around the top-nav binder book.
- Makes the book slightly larger with a cleaner blue-and-gold hover glow.
- Adds a star control to every owned card in your binder. Click it to set or clear your favourite.
- Stores the favourite card in Supabase so it follows the account across devices.
- Adds the selected Favourite Card to Watch Party profile cards for all viewers.

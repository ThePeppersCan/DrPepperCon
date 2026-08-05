Repo Company TCG — Standard + Platinum card update

1. Run quidditch-tcg-add-standard-platinum-cards.sql once in Supabase SQL Editor.
2. Replace index.html and script.js.
3. Upload the assets/quidditch-tcg/cards/standard and platinum folders.
4. Hard-refresh with Ctrl+F5.

Adds 16 Standard cards and 9 Platinum cards (55 total cards).
Pull chances while each pool still has unowned cards: Legendary 4%, Platinum 8%, Full Art about 29%, Standard remainder. Packs remain duplicate-proof.


SQL RETURN-TYPE FIX:
This version drops and safely recreates the four TCG RPC functions before defining their updated return columns. It does not drop the collection table or delete cards. If the previous migration failed with SQLSTATE 42P13, simply run the corrected SQL file from the beginning.

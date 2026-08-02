QUIDDITCH WATCHTIME PERSISTENCE FIX

1. Upload/replace the website files from this ZIP.
2. In Supabase, open SQL Editor and run the complete add-quidditch-watchtime.sql file once.
3. Hard-refresh every test browser/account with Ctrl+F5.
4. Sign in and open Quidditch Mode.

The characters table is now the authoritative storage location. The previous
separate watch-time table is mirrored only for backwards compatibility.
Every watched second is 1 Quidditch Watchtime XP and the saved total is used by:
- the live Watch Party hover card;
- the signed-in player's Skills tree;
- every public leaderboard/player Skills profile;
- refreshes and different browsers/devices.

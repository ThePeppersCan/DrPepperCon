REPO COMPANY — GOLDEN SNITCH 0:00 HANDOFF FIX

1. Drag script.js into the website's main/root folder.
2. Choose Replace/Overwrite.
3. In Supabase, open SQL Editor and run the entire contents of:
   fix-quidditch-snitch-zero-second-handoff.sql
4. Deploy the website.
5. Hard-refresh with Ctrl + F5.

WHAT THIS CHANGES
- The normal Golden Snitch FULL TIME screen still lasts 30 seconds.
- As soon as it reaches 0, the browser asks the shared database clock to begin
  the next match lineup immediately.
- If the original Snitch finish request was lost, the zero-second handoff safely
  reconstructs it and advances rather than waiting for the old regulation clock.
- Calls from several viewers are safe and can advance the match only once.
- All Binder V5 natural effects and earlier website fixes remain included.

No account, GP, card, leaderboard or career data is reset.

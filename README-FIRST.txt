REPO COMPANY — RANDOM EVENTS + FIVE-PLAYER LEADERBOARDS

1. Drag script.js into the main/root website folder beside index.html.
2. Choose Replace/Overwrite when prompted.
3. In Supabase, open SQL Editor and run the full contents of:
   fix-five-visible-leaderboard-players.sql
4. Deploy the website and hard-refresh it with Ctrl + F5.

WHAT THIS FIXES
- Restores the Woodcutting, Mining and Fishing event circles.
- Adds a watchdog so browser timer/page refresh issues cannot permanently stop them.
- Uses a shuffled rotation so all three event types appear before the cycle repeats.
- Keeps Admin hidden from daily/global leaderboards while filling all five positions.

This script.js is based on the latest amended version and retains the One Week LTD pack,
Barry tipping, sudden-death movement and private Admin binder fixes.

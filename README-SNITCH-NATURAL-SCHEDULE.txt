REPO COMPANY — NATURAL QUIDDITCH SET-PIECE RELIABILITY

Replace:
  web2/script.js

Then hard-refresh the website with Ctrl + F5.

Changes:
- Penalty matches now use an exact deterministic 1-in-8 schedule.
- Golden Snitch matches now use an exact deterministic 1-in-14 schedule.
- The two schedules use disjoint match slots, so a penalty can never cancel a selected Snitch match.
- This removes the long dry streaks created by hashing sequential match IDs.
- The existing catch-up trigger remains, so joining late or briefly tabbing out cannot skip the event.

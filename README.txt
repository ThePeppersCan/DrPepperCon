REPO SPORTS WATCH XP + REPOGGLE FIX

Replace these website-root files:
- index.html
- script.js
- repoggle.js

Then run once in Supabase SQL Editor:
- fix-quidditch-watch-agility-xp.sql

Fixes:
1. Repo Sports spectator Agility XP resumes at 400 XP/min while the broadcast is open and visible.
2. The compact WATCH XP badge is restored to the TV's bottom-right position instead of stretching across the top.
3. The XP drop appears immediately above the badge.
4. Repoggle armoured charged pegs can only count as one charged target. Repeated collisions after the peg is cleared do not reduce the remaining-target counter or award repeated clear credit.

This patch does not alter Quidditch Ground combat, World Cup content, Repo Rooftops, or normal Repo Combat balance.

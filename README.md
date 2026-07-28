# Con of Dr Pepper — Agility Minigame

## Updating an existing live site

1. Upload the updated website files to GitHub.
2. In Supabase, open **SQL Editor**.
3. Run `update-agility-minigame.sql` once.
4. Wait for GitHub Pages to deploy, then hard-refresh with **Ctrl + F5**.

The SQL update keeps all accounts, current XP, collection logs and the shared can total.

## Agility game

After logging in, click **LEVEL AGILITY** at the top of the game strip. Press **START COURSE** and click all 15 flashing targets. Faster average reactions award more XP:

- 300ms or faster: 120 XP
- 301–450ms: 90 XP
- 451–650ms: 70 XP
- Slower: 50 XP

The window can be closed at any time. XP is only awarded after completing all 15 targets.

## Dr Pepper Dash update
The Agility course now shows the curly-haired Con chasing small Dr Pepper targets. The supplied Mark of Grace image is used as the Agility icon. No additional Supabase SQL is required if the Agility update was already run.


## Player profiles and fastest Dash leaderboard
Run `update-player-stats-and-dash-leaderboard.sql` once in Supabase SQL Editor before uploading the updated website. This preserves existing data.

## Jad simulator / Slayer update
Run `update-jad-simulator.sql` once in Supabase SQL Editor before using the Level Slayer button. This preserves existing accounts and progress.


## Combat Survival update
Run `update-combat-survival.sql` once in Supabase SQL Editor, then upload all files. The new Level Combat game lasts 60 seconds and awards Attack, Strength and Defence XP.

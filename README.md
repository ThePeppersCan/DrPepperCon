# Repo Company — Watch Party Skill Cards Update

Changes in this build:

- Removed Quidditch Watchtime from personal skill trees.
- Removed Quidditch Watchtime from public player/leaderboard skill trees.
- Removed Quidditch Watchtime counters and database heartbeats from Watch Party cards.
- Active Watch Party hover cards now show:
  - Total Skill Level with the Skills icon.
  - Highest Skill with that skill's icon and level.
  - Highest Scoring Pet, unchanged.
- Quidditch Mode, live viewers, matches, predictions, pets, and spectator Agility XP continue to work normally.

No Supabase SQL is required for this visual/functionality change. Replace the site files and hard-refresh the browser.

## This update
- NPC Contact portraits now use one fixed 72 × 82 display area so Grace, Gertrude and Party Pete appear consistently sized.
- Homepage pet rooms now render each player's equipped name tag above their active pet for every visitor.
- Run `add-pet-room-nametags.sql` once in Supabase so `get_active_pets()` returns the equipped name tag for all players.
- Quidditch Mode now uses that same shared active-pets data, so remote players' equipped name tags display for every viewer.

## Party Pete Watchcard Shop

- Every Watchcard Background costs 25,000 GP.
- A successful purchase deducts 25,000 GP, adds the backdrop to the player's Bank, and equips it to their Quidditch Watchcard.
- Run `add-party-pete-watchcards.sql` once in Supabase. This is required for permanent purchases; Admin Mode remains a temporary visual test only.

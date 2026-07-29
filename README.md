# Repo Company clan website

This package is the complete rebranded site. The old Dr Pepper and Connor-facing theme has been removed from the interface and minigames.

## Upload
Upload everything in this folder to GitHub Pages, replacing the existing site files. Then hard-refresh with Ctrl + F5.

## Supabase
No new SQL is required for this visual/theme update. Existing accounts and progress are preserved. The internal authentication email domain and legacy collection IDs are intentionally retained so old accounts and saved collection logs continue to work.


NEW: Run update-combat-difficulties-runecrafting-pool.sql in Supabase before using Combat difficulty rewards or Rune Pool multiplayer.

## Single-player Rune Pool and Inferno Combat

- Rune Pool now supports a local computer opponent on Easy, Medium, or Hard. Online room-code multiplayer is unchanged.
- Level Combat now includes Inferno: one large boss plus moving fire walls with safe gaps.
- No new Supabase SQL is required for these two additions; they use the existing Runecrafting and Combat reward functions.


## Personal bank update
Run `update-bank.sql` once in Supabase. The Bank button shows each account's GP and includes persistent `bank_items` storage ready for the future shop.


## Cook's Assistant mini quest
Run `update-cooks-assistant.sql` once in Supabase. This adds Cooking XP, quest progress, completion rewards, the Quest Journal and the playable Lumbridge ingredient-gathering route.

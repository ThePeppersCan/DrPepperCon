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

## Chef's hat pet cosmetic
After `update-achievements.sql`, run `update-pet-chefs-hat.sql` once in Supabase. The hat remains a Bank item; EQUIP/UNEQUIP only changes the cosmetic shown on the active pet.

## Insane Inferno rework
- Fixed INSANE Inferno wave/hazard spawning.
- Inferno now has escalating enemy waves followed by a final boss.
- Added four Inferno enemy types, fire-wall dodges, telegraphed volcanic eruptions, improved arena scenery and a wave display.
- INSANE has six waves, tighter wall gaps, faster hazards and more boss eruptions.
- No Supabase SQL update is required for this change.

## Cooking / total-level leaderboard fix
Run `fix-cooking-total-levels.sql` once in Supabase after uploading this version. It makes the account header, clicked player profiles, and main leaderboard use the same 11 skills, including Cooking. It preserves all accounts and XP.

## Inferno timer removal
- Inferno combat now has no time limit; runs continue until the player dies or defeats the final boss.

## Three additional combat weapons
This build adds Dharok's Greataxe, Tumeken's Shadow and the Toxic Blowpipe.
Run `add-three-combat-weapons.sql` once in the Supabase SQL Editor so each new weapon awards the correct Melee, Magic or Ranged XP.


## Fire cape / Raids / Mining dialogue update
Run `add-fire-cape-achievement.sql` once in Supabase SQL Editor. This awards the Fire cape for an Insane Jad completion and allows it to be equipped on the active pet.

## Daily Farm Run answer-lock fix
Run `fix-daily-farm-run-answer-lock.sql` once after this update. It freezes one answer per UTC day and repairs today's stored tile feedback, preventing word-list changes from altering a puzzle in progress.


HARMONY GROUP SKILL
-------------------
Run add-harmony-group-skill.sql once in Supabase SQL Editor after uploading this version. It preserves the existing shared click count and treats it as Harmony XP.

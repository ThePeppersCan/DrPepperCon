REPO SPORTS QUIDDITCH GROUND — LONG-TERM PROGRESSION & REPLAYABILITY PASS
2026-08-07

INSTALL
1. Drag index.html and the assets folder into the ROOT of the website and replace the existing files.
2. In Supabase SQL Editor, run repo-sports-quidditch-survivor-progression.sql ONCE.
   - Run the original add-repo-sports-quidditch-survivor.sql first if that original migration has never been installed.
   - The game still keeps local progression if the new SQL is not installed, but cross-device progression, modifier-aware GP saving and the public high-score board require the new SQL.

FILES
- index.html
- assets/quidditch-survivor/quidditch-survivor.js
- assets/quidditch-survivor/quidditch-survivor.css
- repo-sports-quidditch-survivor-progression.sql

WHAT THIS PASS ADDS
- Dedicated Survivor Profile with exactly five sections: Overview, Records, Discoveries, Challenges and Mastery.
- Versioned Quidditch Ground progression data with safe defaults/migration from the old profile fields.
- Career tracking: runs, play time, kills, elites, bosses, Snitches, damage, XP, distance, Broom flights, TCG selections and GP earned.
- Personal records: score, survival time, kills, level, elites, bosses, Snitches, highest hit, damage, XP, fastest boss kill, no-damage streak and most GP in one run.
- NEW RECORD callouts continue to appear on results when a personal best is beaten.
- Recent run history stores 20 compact run/build snapshots; the latest 10 are browsable from Overview.
- Run inspection shows weapon, date, survival time, level, kills, boss status, highest card rarity, GP, modifiers, cards and synergies.
- SAVE BUILD on results stores up to 8 named favourite builds as references only. Saved builds never become automatic starting loadouts.
- Discovery tracking for weapons, evolutions, TCG effects, synergies, enemies, elites, bosses, events and Golden Snitch reward types.
- Evolution Codex and hidden Synergy Codex with ??? entries/hints before discovery.
- Survivor card favourites: up to 3 owned cards can receive only a small +12% offer-weight boost. They are never guaranteed.
- Weapon mastery for Broomstick, Wand and Barry Bramble's Hat using kills, damage, runs, bosses, evolutions/wins and Broom flights where relevant.
- Character mastery automatically follows the actual TCG character cards used in runs.
- Lightweight mastery tiers: Rookie, Bronze, Silver, Gold and Master.
- Unlockable Survivor titles, profile badges and cosmetic Broom flight trails. These do not add permanent combat power.
- Broom mastery cosmetic milestones include Gold/Fire/Stars trail and Broom Master title progression.
- 12 meaningful challenges including First Blood, Golden Boy, Broom Service, No Fly Zone, Pure Magic, No Scratch, Pack Addict, Snitch Hunter, Underdog, Horde Breaker and Quidditch Champion.
- First standard clear unlocks Advanced Match Modifiers rather than raw permanent stats.
- Optional modifiers: Faster Match, Elite League, No Recovery, Card Chaos, Sudden Death and Professional League.
- Modifiers can be combined into a Custom Match and clearly show the resulting score multiplier.
- Harder modifiers change speed, formations, elites, healing, card weighting and boss aggression rather than simply multiplying enemy HP by absurd amounts.
- Score now rewards more than raw kills: bosses, Snitches under danger, kill momentum, no-damage play and optional match difficulty all matter.
- Modifier GP uplift is deliberately much smaller than score uplift and remains capped so Quidditch Ground does not become an accidental GP-printing method.
- Public high-score leaderboard uses each player's best valid submitted run rather than letting one player fill every slot.
- Every match receives a unique submission UUID; repeated backend submission of the same run pays 0 additional GP.
- Server-side modifier IDs/multiplier and broad plausibility limits are validated before leaderboard storage.
- CatAsthma TEST RUN mode is explicitly non-persistent: no GP, records, progression or leaderboard submission.
- Admin-only debug API supports challenge grant/reset, evolution/synergy unlock, mastery progress and resetting ONLY Quidditch Ground progression.
- Run history is capped at 20 and saved builds at 8 so progression data cannot grow forever.
- TCG collection ownership remains about build OPTIONS, not permanent baseline damage.

INTENTIONALLY NOT ADDED
- No new meta currency.
- No prestige/ascension grind.
- No battle pass/FOMO system.
- No giant permanent damage/HP upgrades.
- No forced Daily/Weekly or Endless framework in this pass; those were optional in the brief and were left out rather than adding a fragile time/seed system without a dedicated backend design.
- No separate duplicate achievement system on top of Challenges; the challenge/title/badge layer already covers the same goal without clutter.

PRESERVED
- Previous premium VFX/HUD/game-feel pass.
- Previous professional gameplay/balance pass.
- Barry Commentary pressure/balance changes.
- Faster movement and TCG card-strip reset fixes.
- Existing TCG clarity work.
- Stadium/location cards without proper live abilities remain excluded until the dedicated card-abilities pass.
- NORMAL REPO COMBAT SURVIVAL IS NOT MODIFIED BY THIS PATCH.

REPO SPORTS QUIDDITCH GROUND — PROFESSIONAL POLISH PASS
=======================================================

Drop these files into the website root and replace when prompted.

FILES CHANGED
- index.html
  - Cache-busts only the Quidditch Ground survivor JS/CSS so the live site loads this patch immediately.
- assets/quidditch-survivor/quidditch-survivor.js
- assets/quidditch-survivor/quidditch-survivor.css

IMPORTANT SCOPE
- Normal Repo Combat Survival code, maps, weapons, enemies and balancing were not edited.
- This remains isolated to Repo Sports Quidditch Ground.
- The previous Barry Commentary pressure nerf, run-card reset fix and 207 movement speed are retained.
- This pass does NOT redesign individual TCG/stadium card abilities. Cards waiting for the dedicated ability pass remain excluded from Survivor choices.

POLISH APPLIED
- Opening pressure starts immediately with controlled nearby groups instead of long empty walks.
- XP curve tuned so the first level-up generally lands in the intended early window and subsequent early upgrades keep moving.
- Movement response tightened while keeping the existing small speed increase.
- Anti-camp pressure now reacts to prolonged stationary play after the opening phase; Barry Commentary cannot hold a permanent safe bubble.
- Enemy movement now uses per-enemy variation, interception, strafing and a spatial-hash separation pass instead of stacked straight-line blobs.
- Added composed wave shapes: ring, two-sided, columns, swarms, fast flanks, heavy walls, elite escorts and mixed waves.
- Contact damage has clearer grace windows and collision separation so overlapping enemies cannot machine-gun the player.
- Enemy projectile/boss-hit grace windows reduce unfair burst damage.
- Boss charges now telegraph before movement rather than instantly lunging.
- Broom melee has faster physical spin timing, sweep afterimages, per-rotation audio, a heavier final whip and restrained heavy-impact shake.
- Broom Magic now has a defined job: Wind Lances receive extra effectiveness against ranged enemies, elites and bosses.
- Mana rhythm tuned toward MELEE -> recharge -> MAGIC burst -> back to MELEE.
- Flight launches harder, steers more cleanly, knocks enemies away more strongly, leaves readable speed trails and eases out into a landing spin.
- Flight/Wand/Hat recharge-ready feedback is now primarily HUD pulse + sound instead of repeated screen banners.
- Added 2 run rerolls and 1 skip to level-up choices.
- Upgrade offering is weighted toward the current weapon/build and existing cards instead of being purely random.
- Potential synergies get a subtle SYNERGY POSSIBLE indicator without revealing hidden results.
- Evolution requirements/hints are surfaced once the build gets close.
- Rare TCG choices receive restrained reveal treatment and improved rarity weighting appropriate to a 15–20 minute run.
- Elites now give larger XP and can grant heal/resource/card-choice rewards.
- Boss kills now create a major recovery + TCG progression moment.
- Golden Snitch movement is curved/predictable with bursts, orbit-like turns and a visible trail instead of hard random direction snapping.
- Damage numbers aggregate rapid hits on the same target to reduce visual spam.
- Screen shake is reserved for heavier broom hits, boss impacts, evolutions and large critical moments.
- Camera smoothly opens during flight/high speed and adjusts around boss encounters.
- Music intensity now ramps through run phases without restarting the track.
- Results screen now shows more run stats, NEW BEST callouts, actual TCG card images, synergies and build damage.
- PLAY AGAIN immediately restarts with the same weapon; MATCH SETUP still returns to weapon selection.
- Hard caps/pooling/cleanup retained, with additional projectile/trail/telegraph caps for late-game stability.

CHECKS PERFORMED
- JavaScript syntax check: passed.
- Runtime harness: opening, Broom, Wand and Barry Commentary paths executed without uncaught errors.
- Late-game stress harness: reached the 360-enemy cap with active particles/orbs without runtime errors.
- Patch diff is restricted to the isolated Quidditch Ground assets plus index cache-busting references.

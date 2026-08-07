REPO SPORTS QUIDDITCH GROUND — FINAL QA / RELEASE HARDENING PASS
2026-08-07

INSTALL
1. Drag index.html and the assets folder into the ROOT of the website and replace the existing files.
2. In Supabase SQL Editor, run repo-sports-quidditch-survivor-progression.sql ONCE.
   - It is safe to run over the previous progression migration: CREATE/ALTER statements are idempotent where required.
   - Run the original add-repo-sports-quidditch-survivor.sql first only if that original migration was never installed.

FILES
- index.html (Quidditch asset cache version only)
- assets/quidditch-survivor/quidditch-survivor.js
- assets/quidditch-survivor/quidditch-survivor.css
- repo-sports-quidditch-survivor-progression.sql

FINAL QA FIXES
- Frame-rate-independent flight collision and projectile swept collision so low FPS/high speed do not skip targets.
- Broom flight can damage a boss only once per flight pass instead of once per rendered frame.
- Flight charge/lockout/recharge values are clamped and reset from one authoritative run state.
- Actual flight is the only flight-invulnerability window; it is cleared on landing, death, exit and restart.
- Attack-speed, movement-speed, crit, damage and flight extremes now have safety limits that preserve strong endgame builds without allowing zero-cooldown/NaN/Infinity behaviour.
- Upgrade ranks have explicit maxima; maxed choices stop appearing and a full build receives deliberate fallback rewards instead of soft-locking.
- Unsupported/no-effect TCG choices (including Wrong Hoop) are excluded defensively.
- Missing card art falls back to a readable card tile instead of a broken-image choice.
- Recursive on-kill/explosion proc chains have a bounded chain depth to stop true infinite loops while preserving spectacular chain reactions.
- Boss director will not overwrite an active boss; boss rewards are guarded against duplicate processing.
- Boss-created projectiles/telegraphs are cleaned when the boss dies.
- Death + level-up races are resolved so no upgrade menu can open after lethal damage.
- Final-boss-death vs lethal-player-damage has a deterministic priority rule.
- Window blur/tab hiding clears held input and resets frame timing; Q/Flight actions ignore key-repeat spam.
- Tutorial/countdown timers, HUD, VFX, boss/snitch/event state, projectiles and arrays are explicitly cleaned on mode exit.
- Temporary stolen armour now actually affects damage while active and expires cleanly.
- V2 result-save failures no longer fall back to a second GP RPC unless the V2 RPC is genuinely absent, preventing ambiguous network failures from double-paying.
- Debug/admin mutations immediately mark the active run TEST RUN; debug finish/state hooks are admin-only.
- SQL keeps run UUID idempotency, tightens boss/Snitch plausibility, and records the Quidditch game version with each V2 leaderboard run.

PRESERVED
- Premium VFX/HUD/game-feel pass.
- Professional gameplay/balance pass.
- Long-term progression, records, challenges and mastery.
- Barry Commentary pressure/balance changes.
- Faster movement and TCG card-strip reset fixes.
- Existing TCG clarity work.
- Stadium/location cards without proper live abilities remain excluded until the dedicated card-abilities pass.

ISOLATION
This patch changes only Quidditch Ground JS/CSS, its progression SQL, and the two Quidditch cache-bust references in index.html. It does NOT rebalance or rewrite normal Repo Combat Survival.

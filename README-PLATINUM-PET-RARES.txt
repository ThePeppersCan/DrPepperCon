REPO COMPANY — MULTIPLAYER HORDE DUO RAIDCARD + PLATINUM PET RARE

INSTALL
1. Replace your existing web2/script.js with the included web2/script.js.
2. Keep multiplayer-horde-leaderboards.sql installed in Supabase from the earlier Multiplayer Horde leaderboard patch.
3. Hard-refresh BOTH players with Ctrl + F5 and create a fresh Multiplayer Horde room.

FIXED
- Multiplayer Horde leaderboard rows now open the Duo Horde Raidcard on hover, focus or click.
- The card appears in the browser's top layer and shows both players, weapons, wave, kills, run time, map and each separate upgrade build.
- Older leaderboard runs with string-based upgrade records remain supported.

PLATINUM PET COMPANION
- Each player's Multiplayer Horde upgrade roll has a separate exact 1-in-100 chance to become Platinum.
- Platinum presents one choice only: the player's currently active pet joins the run.
- The pet follows its owner and automatically attacks a nearby enemy.
- Support damage is deliberately balanced: 20% of the owner's current damage, minimum 4 and capped at 14, approximately once every 1.15 seconds.
- The host remains authoritative and synchronises both companions to the joining player.
- The Platinum Companion is recorded on the Duo Horde Raidcard.

RARE FEEDBACK
- Golden and Platinum upgrade screens have separate animated card treatments, sparkles and full-screen reward bursts.
- Golden and Platinum offers and selections play distinct WebAudio reward chimes.
- Golden remains a 1-in-100 double-power Horde upgrade.

CATASTHMA ADMIN TESTING
With admin testing enabled, the Multiplayer Horde menu includes:
- PREVIEW GOLDEN RARE
- PREVIEW PLATINUM PET
- NEXT HOST UPGRADE: GOLDEN
- NEXT HOST UPGRADE: PLATINUM

Console equivalents:
  repoPreviewMultiplayerGoldenUpgrade()
  repoPreviewMultiplayerPlatinumUpgrade()
  repoForceNextMultiplayerGoldenUpgrade()
  repoForceNextMultiplayerPlatinumUpgrade()

No new SQL changes are required for this patch. The existing JSONB upgrade columns support the new tiered upgrade records.

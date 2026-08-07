REPO ROOFTOPS — ENDLESS SAVE / LEADERBOARD FIX

WHAT WAS WRONG
Long Endless runs could contain dozens or hundreds of completed rooftops. At the results screen the browser re-sent EVERY completed rooftop to Supabase before it was allowed to submit the final run. One transient request was enough to put the run into PENDING SAVE, so the run never reached claimed status and therefore never appeared on the leaderboard.

WHAT THIS PATCH DOES
1. repo-rooftops.js no longer replays the entire rooftop history when an Endless run ends.
2. Live per-rooftop validation still runs during gameplay.
3. The final claim is still server validated and idempotent.
4. The server claim can safely reconcile a plausible missing tail if a live validation request was lost.
5. Pending runs retry the final claim directly instead of re-sending 50/100/200 rooftop RPCs first.
6. The leaderboard continues to show only successfully claimed server runs.
7. Existing GP reward balancing is preserved.

INSTALL
A) Drag index.html and repo-rooftops.js into the website root and replace the existing files.
B) In Supabase SQL Editor, run fix-repo-rooftops-endless-save.sql ONCE.

YOUR CURRENT PENDING RUN
The screenshot run is already stored locally as a pending idempotent claim. After installing BOTH parts above, reopen Repo Rooftops while logged in. It will automatically retry the exact same run. If the server still has that run in active/claimable state, it should save and then appear on the Endless leaderboard without paying the reward twice.

SCOPE
This patch only targets Repo Rooftops save/finalisation behaviour and its cache-bust in index.html. It does not rebalance Rooftops gameplay and does not modify normal Repo Combat or Repo Sports Quidditch Ground gameplay.

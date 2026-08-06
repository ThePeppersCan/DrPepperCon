REPO COMPANY — COMPLETE WILDERNESS HORDE REVERT

1. Copy index.html and script.js into the website root folder.
2. Choose Replace/Overwrite when prompted.
3. In Supabase -> SQL Editor, run remove-wilderness-horde.sql once.
4. Deploy the site.
5. Hard-refresh with Ctrl + F5.

This restores the exact website JavaScript from immediately before Wilderness
Horde was added. The original three Endless Horde maps, Fighter Forge scrolling,
Binder previews and the Gnome Dwarf Cannon remain.

The SQL removes only Wilderness leaderboard entries and Wilderness map support.
Normal Horde scores and all unrelated account data are preserved.

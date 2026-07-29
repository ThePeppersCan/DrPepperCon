GNOME KITCHEN CHAOS ONLINE

1. Upload every file in this website package.
2. Run update-cooking-minigame.sql in Supabase if you have not already done so.
3. Supabase Realtime must be enabled for the project. The game uses public Realtime Broadcast channels and does not require a new database table.
4. One player chooses CREATE ONLINE KITCHEN and shares the six-character code.
5. The second signed-in player chooses JOIN WITH CODE and enters it.
6. Both players use WASD to move and E to interact on their own device.

The host is authoritative for the shared kitchen state. Both players receive the Cooking XP reward at the end of a completed shift.

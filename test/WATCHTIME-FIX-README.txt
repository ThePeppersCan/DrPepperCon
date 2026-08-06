QUIDDITCH WATCHTIME FIX

1. Replace your website files with this build.
2. In Supabase > SQL Editor, run the full add-quidditch-watchtime.sql file once.
3. Make sure every tester refreshes the page so they are using this new script.

What changed:
- Every signed-in account sends its own server heartbeat whenever Quidditch Mode is open.
- Totals are stored by authenticated user ID and username, so they survive refreshes.
- Other viewers poll the saved totals and display them live.
- Public leaderboard player profiles now include Quidditch Watchtime.
- Time is not credited while Quidditch Mode is closed.

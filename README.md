# Con of Dr Pepper — username/password accounts

## Supabase setup

1. Open **Supabase → SQL Editor → New query**.
2. Paste all of `supabase-setup.sql` and press **Run**.
3. Open **Authentication → Providers → Email**.
4. Make sure Email provider is enabled.
5. Turn **Confirm email** OFF and save.

The website uses Supabase Auth securely. It converts a username into a hidden internal address such as `cat_asthma@conofdrpepper.local`; visitors never enter or see an email.

## Upload

Upload every file in this folder to the root of the GitHub repository, replacing the old files. Wait for GitHub Pages to redeploy, then hard-refresh with `Ctrl + F5`.

## Notes

- Usernames: 3–16 letters, numbers, `_` or `-`; no spaces.
- Passwords: at least 8 characters.
- Accounts and progress work across devices.
- The SQL resets old browser-only minigame characters but does not reset the shared can counter.
- With no real email address, forgotten passwords cannot be recovered automatically. An admin must delete/reset the account in Supabase.


## 30-second events + collection log update

1. Upload the updated website files to GitHub.
2. Run `update-random-events.sql` once in Supabase SQL Editor. Do not rerun the full setup merely for this update, because the full setup resets character accounts.
3. Hard-refresh the website with Ctrl + F5.

A resource event is attempted every 30 seconds while a character is logged in and the tab is visible. Each successful click has a 4% (about 1 in 25) collection-log roll. Duplicate drops can still appear in the message, but each item only occupies one collection-log slot.

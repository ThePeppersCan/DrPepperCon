# Con of Dr Pepper — shared counter

## 1. Run the database setup
Open Supabase -> SQL Editor -> New query. Paste all of `supabase-setup.sql` and press Run.

It is safe to run even if you already created the original counter table.

## 2. Add the publishable key
Open `script.js` and replace:

PASTE_YOUR_FULL_PUBLISHABLE_KEY_HERE

with the full `sb_publishable_...` key from Supabase -> Settings -> API Keys.
Do not use or upload the secret key.

The project URL is already filled in.

## 3. Upload to GitHub
Replace your current website files with these files, commit, and wait for GitHub Pages to redeploy.

Open the site on two devices. A click on either one should update both.

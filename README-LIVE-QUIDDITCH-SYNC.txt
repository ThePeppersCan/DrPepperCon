LIVE QUIDDITCH SYNC UPDATE

1. Upload all website files.
2. Run add-live-quidditch-predictions.sql in Supabase SQL Editor again.

The SQL now owns the goal timeline. Movement, possession, broom selection,
shots, goals and commentary are rendered deterministically from the shared
match ID and server clock, so every viewer sees the same broadcast.

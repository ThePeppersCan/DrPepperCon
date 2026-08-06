-- Optional Wise Old Man refresh. Run once after your existing Wise Old Man SQL.
alter table if exists public.wise_old_man_tasks add column if not exists task_variant text;
-- The website now recognises themed task_variant values and enforces melee-only Combat tasks.
-- Recommended variants: agility_sprint, agility_marathon, slayer_hunter, slayer_jad, combat_melee, combat_survivor, sailing_cargo, sailing_storm, runecrafting_focus, runecrafting_master.
-- Update your assign_wise_old_man_task function to randomly populate one of the matching variants and increase reward_gp by 35-90% for marathon/master/storm variants.

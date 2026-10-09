-- Row-level security tests for the Signet schema. Run by scripts/test-db.sh.
-- Each block raises an exception if a rule is broken.
\set ON_ERROR_STOP on

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"full_name":"Ada"}'),
  ('00000000-0000-0000-0000-00000000000b', '{}');

-- Sign-up created profiles.
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'profiles created on sign-up';
  assert (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Ada', 'display name copied';
end $$;

-- The sign-up helper can't be called directly.
do $$ begin
  assert not has_function_privilege('anon', 'public.handle_new_user()', 'execute'), 'anon can call handle_new_user';
  assert not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), 'users can call handle_new_user';
end $$;

-- ---- As user A ----
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false); end $$;

insert into public.signatures (id, doc) values ('sig_1', '{"name":"A sig"}');
insert into public.cards (slug, signature_id, data) values ('ada-card', 'sig_1', '{"n":"Ada"}');
insert into storage.objects (bucket_id, name) values ('signet-images', '00000000-0000-0000-0000-00000000000a/s/abc.png');

-- Revision bumps on update, and a stale revision updates nothing.
update public.signatures set doc = '{"name":"v2"}' where id = 'sig_1' and revision = 1;
update public.signatures set doc = '{"name":"stale"}' where id = 'sig_1' and revision = 1;
do $$ begin
  assert (select revision from public.signatures where id = 'sig_1') = 2, 'revision bumped once';
  assert (select doc ->> 'name' from public.signatures where id = 'sig_1') = 'v2', 'stale write ignored';
end $$;

-- A user can't raise their own plan.
do $$ begin
  begin
    update public.profiles set plan = 'pro';
    raise exception 'plan was writable';
  exception when insufficient_privilege then null;
  end;
end $$;
update public.profiles set prefs = '{"brand":{}}';

-- Can't upload into someone else's folder, or write rows for someone else.
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('signet-images', '00000000-0000-0000-0000-00000000000b/s/x.png');
    raise exception 'uploaded into another user''s folder';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.signatures (owner, id, doc) values ('00000000-0000-0000-0000-00000000000b', 'sig_x', '{}');
    raise exception 'wrote a signature for another user';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---- As user B ----
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false); end $$;
do $$ begin
  assert (select count(*) from public.signatures) = 0, 'B cannot see A''s signatures';
  assert (select count(*) from public.profiles) = 1, 'B sees only their own profile';
  assert (select count(*) from public.cards where slug = 'ada-card') = 1, 'cards are public to signed-in users';
end $$;
update public.signatures set doc = '{"hacked":true}' where id = 'sig_1';
update public.cards set data = '{"hacked":true}' where slug = 'ada-card';
delete from public.cards where slug = 'ada-card';

-- ---- Anonymous visitor ----
reset role;
do $$ begin perform set_config('request.jwt.claim.sub', '', false); end $$;
set role anon;
do $$ begin
  assert (select data ->> 'n' from public.cards where slug = 'ada-card') = 'Ada', 'anon can read a card, and B could not change it';
end $$;
do $$ begin
  begin
    perform 1 from public.signatures;
    raise exception 'anon could read signatures';
  exception when insufficient_privilege then null;
  end;
  begin
    perform owner from public.cards;
    raise exception 'anon could read card owners';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.cards (slug, data) values ('anon-card', '{}');
    raise exception 'anon could create a card';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin
  assert (select doc ->> 'name' from public.signatures where id = 'sig_1') = 'v2', 'B could not change A''s signature';
end $$;
-- ---- Live banners: owners only; clicks are written by the edge function alone ----
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false); end $$;
insert into public.live_banners (slug, signature_id, block_id, items, fallback, track)
  values ('adabanner01', 'sig_1', 'blk', '[]', '{"image":"https://x/a.png"}', true);
do $$ begin
  begin
    insert into public.banner_clicks (slug, item) values ('adabanner01', 0);
    raise exception 'a user could write click counts';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
insert into public.banner_clicks (slug, item) values ('adabanner01', 0), ('adabanner01', -1);
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false); end $$;
do $$ begin
  assert (select count(*) from public.banner_clicks) = 2, 'A reads own clicks';
end $$;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false); end $$;
do $$ begin
  assert (select count(*) from public.live_banners) = 0, 'B cannot see A''s banners';
  assert (select count(*) from public.banner_clicks) = 0, 'B cannot see A''s clicks';
  begin
    insert into public.live_banners (slug, owner, signature_id, block_id, fallback) values ('bbanner0001', '00000000-0000-0000-0000-00000000000a', 's', 'b', '{}');
    raise exception 'B could create a banner owned by A';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;
update public.live_banners set track = false where slug = 'adabanner01';
reset role;
do $$ begin
  assert (select track from public.live_banners where slug = 'adabanner01'), 'B could change A''s banner';
end $$;
set role anon;
do $$ begin
  begin
    perform slug from public.live_banners;
    raise exception 'anon could read banners';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Deleting an account removes everything of theirs and nothing of anyone else's.
insert into public.signatures (owner, id, doc) values ('00000000-0000-0000-0000-00000000000b', 'sig_b', '{}');
set role anon;
do $$ begin
  begin
    perform public.delete_my_account();
    raise exception 'anon could call delete_my_account';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false); end $$;
select public.delete_my_account();
reset role;
do $$ begin
  assert (select count(*) from auth.users) = 1, 'A deleted';
  assert (select count(*) from public.signatures) = 1, 'only A''s signatures removed';
  assert (select count(*) from public.cards) = 0, 'A''s card removed';
  assert (select count(*) from public.live_banners) = 0, 'A''s banners removed';
  assert (select count(*) from public.banner_clicks) = 0, 'A''s banner clicks removed';
  assert (select count(*) from public.profiles) = 1, 'only A''s profile removed';
end $$;
\echo 'RLS tests passed'

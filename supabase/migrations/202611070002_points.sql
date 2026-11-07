begin;

-- Item ids are "<kind>:<id>" for the frontend catalog in characterAppearance.ts.
-- Items not listed here are free.
create table public.cosmetic_items (
  id text primary key,
  price integer not null check(price > 0)
);
insert into public.cosmetic_items(id,price) values
  ('color:coral',50),('color:peach',50),('color:butter',50),('color:mint',50),
  ('color:sky',50),('color:lavender',50),('color:rose',50),('color:graphite',50),
  ('shape:squircle',75),('shape:triangle',75),('shape:blob',75),
  ('shape:cloud',100),('shape:flower',100),('shape:star',100),
  ('accessory:round',75),('accessory:square-specs',75),('accessory:monocle',150),
  ('accessory:blush',25),('accessory:freckles',25),('accessory:moustache',75),
  ('accessory:star-pin',250),('accessory:heart-pin',250),('accessory:flower-pin',250);

-- One award per topic, so restarting a topic cannot earn it twice. module_id has
-- no foreign key because earned points outlive a deleted topic.
create table public.point_awards (
  student_id uuid not null references public.profiles(id) on delete cascade,
  module_id uuid not null,
  points integer not null default 100 check(points > 0),
  created_at timestamptz not null default now(),
  primary key(student_id,module_id)
);
create table public.cosmetic_purchases (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.cosmetic_items(id),
  price integer not null check(price >= 0),
  created_at timestamptz not null default now(),
  primary key(user_id,item_id)
);
alter table public.cosmetic_items enable row level security;
alter table public.point_awards enable row level security;
alter table public.cosmetic_purchases enable row level security;
revoke all on public.cosmetic_items, public.point_awards, public.cosmetic_purchases from public, anon, authenticated;

-- Personal sessions have no module. Browser-saved assignment data only counts
-- when it names a real module.
create function public.scored_topic_module(target_student uuid, target_session uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.topic_score_topics t
    left join public.course_assignments a on a.student_id = t.student_id and a.session_id = t.session_id
    left join public.community_topic_copies c on c.owner_id = t.student_id and c.session_id = t.session_id
    join public.course_modules m on m.id::text = coalesce(a.module_id::text, c.module_id::text, t.configuration->'assignment'->>'moduleId')
    where t.student_id = target_student and t.session_id = target_session;
$$;
revoke all on function public.scored_topic_module(uuid, uuid) from public, anon, authenticated;

create function public.award_topic_points() returns trigger
language plpgsql security definer set search_path = '' as $$
declare completed_module uuid := public.scored_topic_module(new.student_id, new.session_id);
begin
  if completed_module is not null then
    insert into public.point_awards(student_id,module_id) values(new.student_id,completed_module) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger award_completed_topic after insert on public.topic_report_snapshots
  for each row when (new.finish_mode = 'completed') execute function public.award_topic_points();

insert into public.point_awards(student_id,module_id,created_at)
  select student_id, module_id, min(created_at) from (
    select student_id, created_at, public.scored_topic_module(student_id, session_id) as module_id
      from public.topic_report_snapshots where finish_mode = 'completed'
  ) completed where module_id is not null group by student_id, module_id;

-- Looks chosen before points existed stay owned.
insert into public.cosmetic_purchases(user_id,item_id,price)
  select c.user_id, i.id, 0 from public.user_customizations c join public.cosmetic_items i on i.id in (
    'color:' || replace(c.appearance->>'color', 'periwinkle', 'graphite'), 'shape:' || (c.appearance->>'shape'),
    'accessory:' || (c.appearance#>>'{accessories,glasses}'), 'accessory:' || (c.appearance#>>'{accessories,face}'), 'accessory:' || (c.appearance#>>'{accessories,pin}'));

create function public.owns_cosmetic(target_user uuid, item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists(select 1 from public.cosmetic_items i where i.id = item)
    or exists(select 1 from public.cosmetic_purchases p where p.user_id = target_user and p.item_id = item);
$$;
revoke all on function public.owns_cosmetic(uuid, text) from public, anon, authenticated;

-- The browser saves appearance directly. A removed key loads as the free default.
create function public.keep_owned_appearance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare slot text;
begin
  if not public.owns_cosmetic(new.user_id, 'color:' || replace(new.appearance->>'color', 'periwinkle', 'graphite')) then new.appearance := new.appearance - 'color'; end if;
  if not public.owns_cosmetic(new.user_id, 'shape:' || (new.appearance->>'shape')) then new.appearance := new.appearance - 'shape'; end if;
  foreach slot in array array['glasses','face','pin'] loop
    if not public.owns_cosmetic(new.user_id, 'accessory:' || (new.appearance#>>array['accessories',slot])) then
      new.appearance := new.appearance #- array['accessories',slot];
    end if;
  end loop;
  return new;
end;
$$;
create trigger keep_owned_appearance before insert or update of appearance on public.user_customizations
  for each row execute function public.keep_owned_appearance();

-- points is null for admins, whose balance is unlimited.
create function public.cosmetic_wallet() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.account_allowed() then raise exception 'Approved account required.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'points', case when exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') then null else
      (select coalesce(sum(points),0) from public.point_awards where student_id = auth.uid())
      - (select coalesce(sum(price),0) from public.cosmetic_purchases where user_id = auth.uid()) end,
    'owned', (select coalesce(jsonb_agg(item_id order by item_id),'[]'::jsonb) from public.cosmetic_purchases where user_id = auth.uid()));
end;
$$;
revoke all on function public.cosmetic_wallet() from public, anon;
grant execute on function public.cosmetic_wallet() to authenticated;

create function public.purchase_cosmetic(target_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item_price integer; balance integer;
begin
  if not public.account_allowed() then raise exception 'Approved account required.' using errcode = '42501'; end if;
  select price into item_price from public.cosmetic_items where id = target_item;
  if item_price is null then raise exception 'Choose a valid item.' using errcode = '22023'; end if;
  -- Serialize purchases so two tabs cannot spend the same points.
  perform 1 from public.profiles where id = auth.uid() for update;
  if not exists(select 1 from public.cosmetic_purchases where user_id = auth.uid() and item_id = target_item) then
    balance := public.cosmetic_wallet()->>'points';
    if balance < item_price then raise exception 'Not enough points.' using errcode = '23514'; end if;
    -- Admin purchases cost nothing, so a later role change cannot leave a debt.
    insert into public.cosmetic_purchases(user_id,item_id,price) values(auth.uid(),target_item,case when balance is null then 0 else item_price end);
  end if;
  return public.cosmetic_wallet();
end;
$$;
revoke all on function public.purchase_cosmetic(text) from public, anon;
grant execute on function public.purchase_cosmetic(text) to authenticated;

notify pgrst, 'reload schema';
commit;

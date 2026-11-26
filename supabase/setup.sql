begin;

create schema if not exists emotion_wheel;
revoke all on schema emotion_wheel from public, anon, authenticated;

create table emotion_wheel.emotions (
  id text primary key
);
insert into emotion_wheel.emotions values
  ('Fearful'),
  ('Scared'),
  ('Helpless'),
  ('Frightened'),
  ('Anxious'),
  ('Concerned'),
  ('Worried'),
  ('Insecure'),
  ('Inadequate'),
  ('Inferior'),
  ('Weak'),
  ('Worthless'),
  ('Insignificant'),
  ('Rejected'),
  ('Excluded'),
  ('Persecuted'),
  ('Threatened'),
  ('Nervous'),
  ('Exposed'),
  ('Angry'),
  ('Let down'),
  ('Betrayed'),
  ('Resentful'),
  ('Humiliated'),
  ('Disrespected'),
  ('Ridiculed'),
  ('Bitter'),
  ('Indignant'),
  ('Violated'),
  ('Mad'),
  ('Furious'),
  ('Jealous'),
  ('Aggressive'),
  ('Provoked'),
  ('Hostile'),
  ('Frustrated'),
  ('Infuriated'),
  ('Annoyed'),
  ('Distant'),
  ('Withdrawn'),
  ('Numb'),
  ('Critical'),
  ('Sceptical'),
  ('Dismissive'),
  ('Disgusted'),
  ('Disapproving'),
  ('Judgmental'),
  ('Condemned'),
  ('Uncomfortable'),
  ('Appalled'),
  ('Revolted'),
  ('Awful'),
  ('Nauseated'),
  ('Detestable'),
  ('Repelled'),
  ('Horrified'),
  ('Hesitant'),
  ('Sad'),
  ('Hurt'),
  ('Embarrassed'),
  ('Disappointed'),
  ('Depressed'),
  ('Unseen'),
  ('Empty'),
  ('Guilty'),
  ('Remorseful'),
  ('Ashamed'),
  ('Despair'),
  ('Grief'),
  ('Powerless'),
  ('Vulnerable'),
  ('Victimised'),
  ('Fragile'),
  ('Lonely'),
  ('Isolated'),
  ('Abandoned'),
  ('Happy'),
  ('Optimistic'),
  ('Inspired'),
  ('Hopeful'),
  ('Trusting'),
  ('Intimate'),
  ('Sensitive'),
  ('Peaceful'),
  ('Thankful'),
  ('Loving'),
  ('Powerful'),
  ('Creative'),
  ('Courageous'),
  ('Accepted'),
  ('Valued'),
  ('Respected'),
  ('Proud'),
  ('Confident'),
  ('Successful'),
  ('Interested'),
  ('Inquisitive'),
  ('Curious'),
  ('Content'),
  ('Joyful'),
  ('Free'),
  ('Playful'),
  ('Cheeky'),
  ('Aroused'),
  ('Surprised'),
  ('Excited'),
  ('Energetic'),
  ('Eager'),
  ('Amazed'),
  ('Awe'),
  ('Astonished'),
  ('Confused'),
  ('Perplexed'),
  ('Disillusioned'),
  ('Startled'),
  ('Dismayed'),
  ('Shocked'),
  ('Bad'),
  ('Tired'),
  ('Unfocused'),
  ('Sleepy'),
  ('Stressed'),
  ('Out of control'),
  ('Overwhelmed'),
  ('Busy'),
  ('Rushed'),
  ('Pressured'),
  ('Bored'),
  ('Apathetic'),
  ('Indifferent');

create table emotion_wheel.counts (
  emotion text primary key references emotion_wheel.emotions(id),
  total bigint not null check (total > 0)
);
create table emotion_wheel.submissions (id uuid primary key);

create function public.record_emotion_vote(choices text[], submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if submission_id is null or coalesce(pg_catalog.cardinality(choices), 0) not between 1 and 130
     or exists (
       select 1 from pg_catalog.unnest(choices) as c(id)
       where not exists (select 1 from emotion_wheel.emotions e where e.id = c.id)
     ) then
    raise exception 'Invalid ballot' using errcode = '22023';
  end if;

  insert into emotion_wheel.submissions (id) values (submission_id)
    on conflict do nothing;
  if not found then return; end if;

  insert into emotion_wheel.counts as tally (emotion, total)
    select distinct id, 1 from pg_catalog.unnest(choices) as c(id) order by id
    on conflict (emotion) do update set total = tally.total + 1;
end;
$$;

create function public.get_emotion_stats()
returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('emotion', emotion, 'total', total)
    order by total desc, emotion), '[]'::jsonb)
  from emotion_wheel.counts;
$$;

create function public.reset_emotion_stats()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from emotion_wheel.counts;
$$;

revoke all on function public.record_emotion_vote(text[], uuid), public.get_emotion_stats(),
  public.reset_emotion_stats() from public;
grant execute on function public.record_emotion_vote(text[], uuid), public.get_emotion_stats(),
  public.reset_emotion_stats() to anon, authenticated;
commit;

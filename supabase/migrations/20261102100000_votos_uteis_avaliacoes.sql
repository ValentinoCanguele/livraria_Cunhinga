create table public.book_review_helpful_votes (
  review_id text not null references public.book_reviews (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index book_review_helpful_votes_user_id_idx
  on public.book_review_helpful_votes (user_id);

alter table public.book_review_helpful_votes enable row level security;
revoke all on public.book_review_helpful_votes from anon, authenticated;
grant select, insert, delete on public.book_review_helpful_votes to authenticated;

create policy "book_review_helpful_votes: o próprio lê"
  on public.book_review_helpful_votes for select to authenticated
  using (user_id = (select auth.uid()));

create policy "book_review_helpful_votes: o próprio vota"
  on public.book_review_helpful_votes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.book_reviews r
      where r.id = review_id
        and r.user_id <> (select auth.uid())
    )
  );

create policy "book_review_helpful_votes: o próprio remove"
  on public.book_review_helpful_votes for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.book_review_helpfulness(p_book_id text)
returns table (review_id text, helpful_count bigint, user_voted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    count(v.user_id),
    coalesce(bool_or(v.user_id = (select auth.uid())), false)
  from public.book_reviews r
  left join public.book_review_helpful_votes v on v.review_id = r.id
  where r.book_id = p_book_id
  group by r.id;
$$;

revoke all on function public.book_review_helpfulness(text) from public;
grant execute on function public.book_review_helpfulness(text) to anon, authenticated;
-- Profiles and applications, one set per Neon Auth user. Deleting a user deletes their data.

create table profiles (
  user_id      uuid primary key references neon_auth."user"(id) on delete cascade,
  name         text not null default '',
  email        text not null default '',
  phone        text not null default '',
  city         text not null default '',
  linkedin     text not null default '',
  github       text not null default '',
  website      text not null default '',
  experience   text not null default '',   -- career text (CV without contact details)
  skills       text not null default '',
  extra_skills text not null default '',   -- skills not on the CV that the AI may use
  languages    text not null default '',
  letters      text not null default '',   -- past cover letters, for tone
  updated_at   timestamptz not null default now()
);

create table applications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references neon_auth."user"(id) on delete cascade,
  job_title       text not null default '',
  company         text not null default '',
  language        text not null check (language in ('fr', 'en')),
  job_ad          text not null,
  sent_to_ai      text not null,             -- exactly what was sent, after redaction
  result          jsonb not null,            -- the AI's answer: keywords, changes, gaps, cv, cover letter
  before_keywords jsonb not null default '[]', -- ad keywords already in the profile before tailoring
  before_bullets  jsonb,                     -- bullet quality of the profile before tailoring
  cv_html         text not null,             -- the CV as shown and edited
  letter_html     text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index applications_by_user on applications (user_id, created_at desc);

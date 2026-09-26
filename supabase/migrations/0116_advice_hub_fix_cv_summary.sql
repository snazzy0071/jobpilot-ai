-- The CV checklist guide's summary said "Ten quick checks" but the guide lists eight. Only changes it if an admin hasn't edited it.
update public.advice_guides
set summary = 'Eight quick checks that catch the problems recruiters notice first — before you press send.'
where slug = 'cv-checklist-before-you-apply'
  and summary = 'Ten quick checks that catch the problems recruiters notice first — before you press send.';

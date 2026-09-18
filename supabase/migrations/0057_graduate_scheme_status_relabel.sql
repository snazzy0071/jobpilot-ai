-- Relabels graduate_schemes.sponsorship_status onto the four-way
-- taxonomy the real filter UI needs (src/lib/graduate-schemes/types.ts,
-- src/components/marketing/grad-scheme-results.tsx): a scheme can fully
-- sponsor, sponsor only some of its tracks/streams, not sponsor at all,
-- or simply never have published anything on it. The original three
-- values from 0056 conflated the last two cases under "unconfirmed" —
-- collapsing "we checked and they said no" with "nothing's been
-- published either way" loses a real distinction the evidence-based
-- methodology this page claims needs to make.
--
-- A new migration rather than editing 0056 in place, per this repo's
-- forward-only migration rule — even though 0056 shipped with zero
-- rows in this table, so there's no real data being remapped here, just
-- the type's own label set. RENAME VALUE (not drop/recreate) so this
-- is safe even if that ever stops being true before this runs.
--
-- sponsors_visas   -> sponsors        (unambiguous, same meaning)
-- does_not_sponsor -> no              (unambiguous, same meaning)
-- unconfirmed      -> not_published   (closest of the old three: no
--                                       public evidence either way)
-- (new)            -> some_tracks     (a scheme with a documented split
--                                       — e.g. one stream sponsors,
--                                       another doesn't — that
--                                       "unconfirmed" never represented)
--
-- The column's existing `default 'unconfirmed'` follows automatically:
-- Postgres enum defaults are stored by the label's internal oid, not
-- its text, so a rename updates what that default displays as without
-- a separate ALTER COLUMN.

alter type public.graduate_scheme_sponsorship_status rename value 'sponsors_visas' to 'sponsors';
alter type public.graduate_scheme_sponsorship_status rename value 'does_not_sponsor' to 'no';
alter type public.graduate_scheme_sponsorship_status rename value 'unconfirmed' to 'not_published';
alter type public.graduate_scheme_sponsorship_status add value 'some_tracks';

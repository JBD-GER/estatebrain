-- finalize_onboarding_v2 is an implementation phase of the atomic public v2
-- wrappers. Keeping it non-executable by browser roles narrows the exposed
-- SECURITY DEFINER surface without changing the application flow.

begin;

revoke execute on function public.finalize_onboarding_v2(uuid, jsonb)
  from authenticated;

comment on function public.finalize_onboarding_v2(uuid, jsonb) is
  'Internal owner-validated implementation used only by the atomic v2 onboarding wrappers; not executable by browser roles.';

commit;

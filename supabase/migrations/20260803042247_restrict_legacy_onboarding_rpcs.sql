-- The legacy functions remain private implementation details for the atomic
-- v2 wrappers. Browser callers must not bypass v2 finalization and leave a
-- partially modeled portfolio behind.

begin;

revoke execute on function public.complete_onboarding(jsonb)
  from authenticated;
revoke execute on function public.resume_portfolio_onboarding(uuid, jsonb)
  from authenticated;

comment on function public.complete_onboarding(jsonb) is
  'Legacy implementation used only by the atomic complete_onboarding_v2 wrapper; not executable by browser roles.';
comment on function public.resume_portfolio_onboarding(uuid, jsonb) is
  'Legacy implementation used only by the atomic resume_portfolio_onboarding_v2 wrapper; not executable by browser roles.';

commit;

export const SIGNUP_ALLOWED_REDIRECTS = [
  '/app/workflows',
  '/app/dashboard',
  '/app/dashboard?intent=simple',
  '/app/workflows/catalogue?mode=simple',
  '/app/workflows/catalogue?mode=advanced',
  '/app/workflows/catalogue/30-day-content-engine',
];

export function resolveSignupOnboardingUrl(search = '') {
  const params = new URLSearchParams(search);
  const intent = params.get('intent');
  const redirectUrl = params.get('redirect_url');
  const onboardingParams = new URLSearchParams();
  if (['simple', 'advanced'].includes(intent)) onboardingParams.set('intent', intent);
  if (SIGNUP_ALLOWED_REDIRECTS.includes(redirectUrl)) {
    onboardingParams.set('redirect_url', redirectUrl);
  }

  return onboardingParams.toString()
    ? `/app/onboarding?${onboardingParams.toString()}`
    : '/app/onboarding';
}

import LegalLayout from './LegalLayout';

const sections = [
  {
    heading: '1. Strictly necessary cookies (no consent required)',
    paragraphs: [
      'These cookies are essential for the platform to function. They cannot be disabled without breaking core functionality. We do not seek consent for strictly necessary cookies.',
      'Clerk session token: set by Clerk (our authentication provider) to maintain your login session. Without this cookie, you cannot stay authenticated in the Prymal workspace. Session duration matches your Clerk session configuration.',
      'Stripe session identifiers: set by Stripe during billing flows (checkout, subscription management). These identifiers are required for fraud prevention and payment processing. They are set only when you interact with billing features.',
      'CSRF protection tokens: short-lived tokens used to protect form submissions and API requests from cross-site request forgery attacks. These are regenerated per session.',
    ],
  },
  {
    heading: '2. Functional cookies (consent required)',
    paragraphs: [
      'These cookies remember your preferences to improve your experience. They are set only after you accept cookies via the consent banner on the marketing site.',
      'User preferences: limited browser storage may be used to remember your UI preferences such as theme (dark/light mode) and recently used workspace settings. This data stays on your device and is not sent to Prymal servers.',
    ],
  },
  {
    heading: '3. Analytics cookies',
    paragraphs: [
      'Prymal uses server-side product events to understand how the platform is adopted and where the experience can be improved. These events are captured by our own backend and are not shared with third-party analytics providers.',
      'Prymal does not use Google Analytics, Meta Pixel, TikTok Pixel, or any similar third-party client-side tracking tools. We do not run retargeting or behavioural advertising.',
      'The marketing site (prymal.io) may use Plausible Analytics — a privacy-focused, cookie-free analytics tool — to measure aggregate page visit counts and conversion rates. Plausible does not use cookies, does not track individuals, and does not process personal data under its standard configuration.',
    ],
  },
  {
    heading: '4. Third-party service cookies',
    paragraphs: [
      'Some third-party services integrated into Prymal set their own cookies or browser storage entries when you interact with their functionality. These include Clerk (authentication session management) and Stripe (billing and checkout). These services operate under their own privacy and cookie policies.',
      'Prymal does not control third-party cookies set by these providers. We encourage you to review their policies for more detail.',
    ],
  },
  {
    heading: '5. How to manage cookies',
    paragraphs: [
      'You can control, block, or delete cookies through your browser settings. The method varies by browser: in Chrome, go to Settings → Privacy and Security → Cookies. In Firefox, go to Settings → Privacy and Security. In Safari, go to Preferences → Privacy.',
      'Disabling strictly necessary cookies (Clerk session, Stripe session, CSRF tokens) will prevent you from logging in or using billing features. Functional cookies can be disabled without breaking core product access.',
      'You can also withdraw your cookie consent at any time by clearing your browser\'s localStorage entry for `cookie_consent` on prymal.io, then reloading the page. The consent banner will reappear.',
    ],
  },
  {
    heading: '6. Changes to this policy',
    paragraphs: [
      'We will update this Cookie Policy if we introduce new cookie types or change how existing ones work. The "last updated" date at the top of this page will reflect any changes.',
      'For questions about cookies or privacy more broadly, contact us at privacy@prymal.io.',
    ],
  },
];

export default function Cookies() {
  return (
    <LegalLayout
      eyebrow="Cookie policy"
      title="How Prymal uses cookies and browser storage."
      description="A clear explanation of which cookies Prymal uses, why they are used, and how to manage your preferences. Prymal does not use third-party tracking cookies."
      sections={sections}
      updated="5 May 2026"
      pageTitle="Prymal Cookie Policy | No tracking cookies — essential only"
      canonicalPath="/cookies"
    />
  );
}

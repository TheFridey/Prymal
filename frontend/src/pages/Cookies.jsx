import LegalLayout from './LegalLayout';

const sections = [
  {
    heading: 'What cookies are used for',
    paragraphs: [
      'Prymal uses cookies and similar browser storage technologies to keep the site and product working properly, remember preferences, maintain authentication sessions, protect the platform, and understand how the marketing site and app are being used.',
      'Some cookies are essential to core functionality, including authentication through Clerk, session continuity, security controls, and saving limited interface preferences such as theme choices or recently used workspace settings.',
    ],
  },
  {
    heading: 'Analytics and performance',
    paragraphs: [
      'We may use privacy-focused analytics tools, such as Plausible, to measure page visits, onboarding progress, pricing interactions, and key product adoption events. These analytics help Prymal understand whether the product is delivering value and where the customer experience needs improvement.',
      'Where analytics are configured, we aim to use implementations that minimise unnecessary tracking and avoid collecting more information than needed for product measurement and operational decision-making.',
    ],
  },
  {
    heading: 'Third-party services',
    paragraphs: [
      'Some third-party services integrated into Prymal, such as Clerk or Stripe, may set their own cookies or similar technologies when required for authentication, fraud prevention, checkout, or subscription management.',
      'Those services operate under their own privacy and cookie policies. We encourage customers to review those policies where they want more detail about processor-specific browser storage behaviour.',
    ],
  },
  {
    heading: 'Managing your preferences',
    paragraphs: [
      'Most browsers allow you to control, block, or delete cookies through browser settings. Doing so may affect how Prymal works, especially features that depend on session persistence, login state, or saved workspace preferences.',
      'If we introduce broader cookie controls inside the product or site, we will update this policy accordingly. Until then, browser settings remain the main way to manage cookie behaviour on Prymal.',
    ],
  },
];

export default function Cookies() {
  return (
    <LegalLayout
      eyebrow="Cookie policy"
      title="How Prymal uses cookies, browser storage, and privacy-focused analytics."
      description="A straightforward explanation of the browser technologies Prymal uses to run the product, secure sessions, and measure adoption."
      sections={sections}
      updated="5 April 2026"
      pageTitle="Prymal Cookie Policy | How we use cookies and analytics"
      canonicalPath="/cookies"
    />
  );
}

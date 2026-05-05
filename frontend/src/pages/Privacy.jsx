import LegalLayout from './LegalLayout';

const sections = [
  {
    heading: '1. Who we are',
    paragraphs: [
      'Prymal is a UK-based AI SaaS platform operated by [COMPANY_LEGAL_NAME], registered at [REGISTERED_ADDRESS] ("Prymal", "we", "us", "our"). We act as the data controller for account, billing, marketing, and workspace administration data.',
      'When customers upload organisation knowledge, messages, files, and workflow inputs into Prymal, we process that information as part of delivering the service. For business customers, Prymal may also act as a data processor where the customer is the controller of their end users\' personal data. A Data Processing Agreement (DPA) is available on request at privacy@prymal.io.',
      'For questions about this policy, to exercise your rights, or to report a concern, contact us at privacy@prymal.io.',
    ],
  },
  {
    heading: '2. What data we collect',
    paragraphs: [
      'Account data: name, email address, organisation name, and authentication identifiers managed through Clerk.',
      'Usage data: agent interactions, workflow runs, feature usage events, session data, and product analytics events recorded by Prymal\'s internal event system. We do not use Google Analytics, Meta Pixel, or similar third-party client-side tracking.',
      'Content data: prompts you submit to agents, documents you upload to the knowledge base (LORE), workflow inputs and outputs, and knowledge base content you create or import.',
      'Technical data: IP address, browser type and version, device identifiers, and infrastructure logs from Railway and Cloudflare required for security monitoring and service reliability.',
      'Billing data: subscription tier, billing interval, and payment history. Stripe manages card data directly — Prymal never sees or stores card numbers, CVVs, or raw payment credentials.',
      'Communications: support messages, feedback submissions, and responses to transactional emails sent by Prymal.',
    ],
  },
  {
    heading: '3. How we use your data',
    paragraphs: [
      'Service delivery and authentication: we use your account and session data to authenticate you, manage your workspace, enforce plan limits, and deliver agent and workflow functionality.',
      'Billing and subscription management: we use Stripe to process payments and manage subscriptions. Stripe processes billing data under their own privacy policy and data processing agreement.',
      'Security monitoring and threat detection: the WARDEN input safety system and SENTINEL output validation system process workspace content to detect and prevent malicious, harmful, or policy-violating inputs and outputs. WARDEN audit events are retained for 1 year.',
      'Product improvement and analytics: we use internal product events to understand how the platform is adopted and where the experience can be improved. This data is not sold to third parties and is not used to train AI models.',
      'Transactional email: we use Resend (via the HERALD email system) to send account confirmations, billing notifications, and other operational emails.',
      'Error monitoring: we use Sentry to capture and investigate application errors. Sentry may include metadata from the error context — we configure Sentry to minimise personal data capture in error reports.',
    ],
  },
  {
    heading: '4. Legal basis under UK GDPR',
    paragraphs: [
      'Contract performance (Article 6(1)(b)): we process account data, usage data, and content data to deliver the service you signed up for. Without this processing, we cannot provide the Prymal platform.',
      'Legitimate interests (Article 6(1)(f)): we process technical data, WARDEN audit events, and product analytics to protect the security and integrity of the platform, prevent fraud and abuse, and improve the product. We have assessed that these legitimate interests are not overridden by your privacy rights.',
      'Legal obligation (Article 6(1)(c)): we retain billing records for 7 years in compliance with HMRC requirements, and we process data as required to comply with applicable law including breach reporting obligations.',
      'Consent (Article 6(1)(a)): we will rely on consent for marketing communications. Consent is separate from the account creation process and can be withdrawn at any time.',
    ],
  },
  {
    heading: '5. Data sharing and third-party processors',
    paragraphs: [
      'Prymal does not sell personal data to third parties. Prymal does not use customer data to train AI models.',
      'We share data with the following sub-processors to deliver the service: Clerk (authentication), Stripe (billing), Railway (hosting), Cloudflare (CDN and security), Resend (transactional email), Sentry (error monitoring), Cloudinary (generated media storage), OpenAI (LLM inference and transcription), Anthropic (LLM inference), and Google (Gemini and Veo — LLM inference and AI video generation).',
      'Prompt content and documents are processed by LLM providers (OpenAI, Anthropic, Google) solely to generate agent responses. These providers process data under their API data processing agreements. Prymal uses API access — not consumer products — which means your content is not used to train foundation models by these providers under their standard API terms. See Anthropic\'s privacy policy, OpenAI\'s privacy policy, and Google\'s privacy policy for their data retention practices.',
      'We may disclose personal data where required by law, court order, or competent regulatory authority. We will notify you of any such disclosure where legally permitted to do so.',
    ],
  },
  {
    heading: '6. Data retention',
    paragraphs: [
      'User accounts and workspace data: retained for the duration of your subscription plus 30 days after cancellation. You may request early deletion at any time.',
      'Execution traces and workflow run logs: retained for 90 days on a rolling basis.',
      'WARDEN audit events: retained for 1 year for security and compliance purposes.',
      'Billing records: retained for 7 years in compliance with HMRC requirements.',
      'Support communications: retained for 2 years to support continuity of customer service.',
      'Email event logs: retained for 1 year.',
      'After the applicable retention period, data is deleted or anonymised. If you cancel your subscription, workspace data (LORE documents, conversations, workflows, agent memory) is retained for 30 days and then permanently deleted unless you request earlier deletion.',
    ],
  },
  {
    heading: '7. Your rights under UK GDPR',
    paragraphs: [
      'You have the following rights in relation to personal data we hold about you: the right to access a copy of your data; the right to rectification of inaccurate data; the right to erasure ("right to be forgotten") subject to legal retention obligations; the right to restrict processing; the right to data portability; the right to object to processing based on legitimate interests; and rights related to automated decision-making.',
      'To exercise any of these rights, email privacy@prymal.io with the subject line "Data Rights Request". We will respond within 1 calendar month. We may ask you to verify your identity before processing a request.',
      'You also have the right to lodge a complaint with the Information Commissioner\'s Office (ICO) at ico.org.uk if you believe we have mishandled your data. We would always prefer to resolve concerns directly first — please contact us before escalating to the ICO.',
    ],
  },
  {
    heading: '8. Cookies',
    paragraphs: [
      'We use essential cookies for authentication (Clerk session token) and security (CSRF protection). We do not use third-party advertising or tracking cookies. For full details, see our Cookie Policy at prymal.io/cookies.',
    ],
  },
  {
    heading: '9. Security',
    paragraphs: [
      'We implement technical and organisational measures to protect personal data against unauthorised access, loss, or destruction. These include the WARDEN input safety firewall, SENTINEL output validation, Clerk-managed authentication with MFA support, TLS encryption for all data in transit, Railway container isolation, and Cloudflare WAF protection.',
      'No system is 100% secure. In the event of a personal data breach that is likely to result in a risk to your rights and freedoms, we will notify you without undue delay and within 72 hours of becoming aware of the breach. We will also notify the ICO where required.',
    ],
  },
  {
    heading: '10. Changes to this policy',
    paragraphs: [
      'We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email to the address associated with your account and update the "last updated" date at the top of this page. We will provide at least 14 days\' notice before material changes take effect.',
      'Continued use of Prymal after a notified change takes effect constitutes acceptance of the updated policy.',
    ],
  },
  {
    heading: '11. Contact and complaints',
    paragraphs: [
      'Data controller: [COMPANY_LEGAL_NAME] — privacy@prymal.io',
      'To exercise your rights or make a privacy enquiry: privacy@prymal.io',
      'To make a complaint to the ICO: ico.org.uk — 0303 123 1113',
    ],
  },
];

export default function Privacy() {
  return (
    <LegalLayout
      eyebrow="Privacy policy"
      title="How Prymal handles your data under UK GDPR."
      description="A full account of the personal data Prymal processes, why it is processed, who it is shared with, and how to exercise your rights as a UK data subject."
      sections={sections}
      updated="5 May 2026"
      pageTitle="Prymal Privacy Policy | UK GDPR — How we handle your data"
      canonicalPath="/privacy"
    />
  );
}

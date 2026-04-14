import LegalLayout from './LegalLayout';

const sections = [
  {
    heading: '1. Acceptance of terms',
    paragraphs: [
      'These Terms of Service ("Terms") form a legally binding agreement between you (the individual or organisation accessing Prymal) and Prymal ("we", "us", "our"). By creating an account, accessing the platform, or using any part of the Prymal service, you confirm that you have read these Terms, that you understand them, and that you agree to be bound by them.',
      'If you are accepting these Terms on behalf of an organisation, you represent that you have the authority to do so and that the organisation agrees to be bound by them. If you do not agree, you must not use the service.',
    ],
  },
  {
    heading: '2. Description of service',
    paragraphs: [
      'Prymal is a UK-based AI SaaS platform that provides access to a suite of specialist AI agents, a shared knowledge layer (LORE), and a workflow execution engine (NEXUS). Agents are designed to handle specific business tasks including content creation, outreach, analysis, reporting, operations planning, SEO, support, and sales — each operating within a shared organisational workspace.',
      'LORE is the knowledge layer that allows organisations to upload documents, notes, website content, and other business materials. This context is stored, indexed, and retrieved to ground agent outputs in your actual business information rather than generic responses. LORE documents are scoped to your organisation and are not shared across workspaces.',
      'NEXUS is the workflow execution engine that allows you to build, schedule, and automate sequences of agent tasks. Trigger.dev powers scheduled workflows where configured. Workflows are explicit: each step is defined, logged, and auditable.',
      'The platform is accessed via a web application at prymal.io. An API is available to Agency plan customers for programmatic access.',
    ],
  },
  {
    heading: '3. Account registration and responsibilities',
    paragraphs: [
      'To use Prymal you must create an account using a valid email address. Authentication is handled through Clerk. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.',
      'You must ensure that any users you add to your organisation workspace are authorised to access the platform and agree to these Terms. As the account owner, you are responsible for the conduct of all users within your workspace.',
      'You must provide accurate, current, and complete information when registering and keep it up to date. We reserve the right to suspend or terminate accounts where registration information is found to be inaccurate, incomplete, or misleading.',
    ],
  },
  {
    heading: '4. Subscription plans, billing, and payment',
    paragraphs: [
      'Prymal is available on several subscription plans: Free, Solo, Pro, Teams, and Agency. Each plan provides a defined number of monthly credits, seat allowances, and feature entitlements. Plan limits are enforced server-side.',
      'Paid plans are billed on a monthly, quarterly, or yearly basis depending on the interval selected at checkout. Billing is processed by Stripe. By providing a payment method, you authorise Stripe to charge the applicable subscription fee on a recurring basis according to your selected interval, until you cancel.',
      'Credits are the unit of consumption on Prymal. Each agent interaction, workflow run, and retrieval operation consumes a defined number of credits. Credits do not roll over between billing periods unless explicitly stated in your plan. If you exhaust your monthly credit allowance, some actions will be restricted until the next billing period or until you upgrade.',
      'Prices are displayed inclusive of VAT where applicable to UK customers. We reserve the right to change pricing with reasonable notice. Continued use after a notified price change constitutes acceptance of the new pricing.',
    ],
  },
  {
    heading: '5. Cancellation and refund policy',
    paragraphs: [
      'You may cancel your paid subscription at any time from your workspace billing settings. Cancellation takes effect at the end of the current billing period. You will retain access to paid features until that date. We do not offer pro-rata refunds for partial billing periods, except where required by applicable UK consumer law.',
      'After your subscription ends, your workspace data — including LORE documents, conversations, workflows, and agent memory — is retained for 30 days. After that period, data may be permanently deleted. You may export your data or request deletion at any time by contacting us at support@prymal.io.',
      'Where a technical fault caused by Prymal prevents you from accessing the service for a sustained period, we will consider reasonable requests for credit or partial refund on a case-by-case basis. This does not affect your statutory rights under UK consumer law.',
    ],
  },
  {
    heading: '6. Acceptable use policy',
    paragraphs: [
      'You must use Prymal only for lawful purposes and in accordance with these Terms. The following activities are prohibited:',
      'Reverse engineering, decompiling, disassembling, or otherwise attempting to extract the source code, system prompts, model weights, or training data from Prymal or its underlying AI model providers. Attempting to probe, extract, or reconstruct proprietary system prompts through adversarial prompting or inference attacks.',
      'Using Prymal to generate, distribute, or facilitate illegal content; to infringe third-party intellectual property rights; to engage in harassment, defamation, or abuse of any individual or group; or to process personal data without appropriate legal basis.',
      'Sharing your API keys, account credentials, or workspace access with unauthorised third parties. Reselling or sub-licensing access to Prymal without our written consent.',
      'Deliberately exceeding rate limits, submitting automated requests at volumes that degrade the service for other users, or attempting to access system components, APIs, or data that are not made available to your account tier.',
      'Using the platform in a way that could expose Prymal, its infrastructure, or its other customers to security risk, regulatory liability, or reputational harm.',
    ],
  },
  {
    heading: '7. AI-generated content disclaimer',
    paragraphs: [
      'Prymal provides outputs generated by large language models (LLMs) operated by third-party AI providers including Anthropic and OpenAI. These outputs are probabilistic in nature and may contain errors, inaccuracies, omissions, or content that is factually incorrect, outdated, or unsuitable for a specific purpose.',
      'You are solely responsible for reviewing, fact-checking, and approving any AI-generated content before using it commercially, legally, medically, or in any other context where accuracy matters. Prymal outputs should not be relied upon as professional advice — legal, financial, medical, or otherwise — without independent expert verification.',
      'We make no warranty that outputs will be accurate, complete, or fit for any particular purpose. The use of any output produced by the platform is at your own risk.',
    ],
  },
  {
    heading: '8. Intellectual property',
    paragraphs: [
      'You retain full ownership of any data, content, documents, and materials you upload to Prymal, including knowledge added to LORE, workflow inputs, prompts, and conversation content. You grant Prymal a limited licence to process, store, and retrieve that content solely to provide the service to you.',
      'Prymal retains all ownership of and rights to the platform itself, including but not limited to: the web application, the agent personas, names, and identities, the system prompts, the LORE architecture, the NEXUS workflow engine, all software code, design assets, and documentation.',
      'Nothing in these Terms transfers ownership of Prymal intellectual property to you. You may not copy, adapt, or create derivative works from Prymal platform components without our express written consent.',
    ],
  },
  {
    heading: '9. Data processing',
    paragraphs: [
      'By using Prymal you acknowledge that we process personal data as described in our Privacy Policy, which is incorporated into these Terms by reference. The Privacy Policy explains what data we collect, how we use it, your rights, and how to exercise them.',
      'Prymal uses sub-processors to deliver the service, including Anthropic and OpenAI (AI model inference), Clerk (authentication), Stripe (billing), and infrastructure providers for hosting and storage. When workspace content is sent to AI model providers for inference, it is processed under their applicable terms and data processing agreements. We do not authorise the use of your content to train third-party foundation models except where you have explicitly opted in to such programmes with the relevant provider.',
      'Prymal is operated from the United Kingdom. If you are located outside the UK, you acknowledge that your data may be transferred to and processed in the UK and in other countries where our sub-processors operate.',
    ],
  },
  {
    heading: '10. Limitation of liability',
    paragraphs: [
      'To the fullest extent permitted by applicable UK law, Prymal is not liable for any indirect, incidental, special, consequential, or punitive losses, including but not limited to: loss of profits, loss of revenue, loss of data, loss of goodwill, or business interruption arising from or in connection with your use of the service.',
      'Our total aggregate liability to you in respect of any claims arising under or in connection with these Terms, whether in contract, tort (including negligence), or otherwise, is limited to the total amount paid by you to Prymal in the 12 calendar months immediately preceding the event giving rise to the claim.',
      'Nothing in these Terms excludes or limits liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, or any other liability that cannot be excluded or limited under applicable UK law.',
    ],
  },
  {
    heading: '11. Governing law',
    paragraphs: [
      'These Terms are governed by and shall be construed in accordance with the laws of England and Wales, without regard to its conflict of law principles.',
      'Any disputes arising out of or in connection with these Terms, including any question regarding their existence, validity, or termination, shall be subject to the exclusive jurisdiction of the courts of England and Wales, except where applicable UK consumer law gives you the right to bring proceedings in another jurisdiction.',
    ],
  },
  {
    heading: '12. Changes to terms',
    paragraphs: [
      'We may update these Terms from time to time to reflect changes in law, product functionality, or business practice. When we make material changes, we will notify you by email (to the address associated with your account), by a notice within the product, or both, with at least 14 days notice before the changes take effect.',
      'Your continued use of Prymal after a notified change takes effect constitutes your acceptance of the revised Terms. If you do not agree to the revised Terms, you must stop using the service and may cancel your subscription before the change takes effect.',
    ],
  },
  {
    heading: '13. Contact',
    paragraphs: [
      'If you have questions about these Terms or need to contact us about your account, data, or a billing matter, please email us at support@prymal.io.',
      'We aim to respond to all support enquiries within two business days. For urgent matters — including security issues or suspected unauthorised access — please mark your subject line accordingly.',
    ],
  },
];

export default function Terms() {
  return (
    <LegalLayout
      eyebrow="Terms of service"
      title="The commercial terms for using Prymal as a business AI platform."
      description="These terms cover account use, subscriptions, acceptable use, service changes, and the core legal framework for Prymal customers."
      sections={sections}
      updated="5 April 2026"
      pageTitle="Prymal Terms of Service | Commercial terms for UK AI SaaS"
      canonicalPath="/terms"
    />
  );
}

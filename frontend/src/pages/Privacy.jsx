import LegalLayout from './LegalLayout';

const sections = [
  {
    heading: 'Who we are',
    paragraphs: [
      'Prymal is a UK-based AI SaaS platform that helps organisations use specialist AI agents, workflows, and knowledge systems to complete business tasks faster. In this policy, "we", "us", and "our" mean Prymal and the operators of the Prymal platform.',
      'We act as the controller for account, billing, marketing, and workspace administration data. When customers upload organisation knowledge, messages, files, and workflow inputs into Prymal, we also process that information in order to provide the service.',
    ],
  },
  {
    heading: 'What data we collect',
    paragraphs: [
      'We collect account details such as name, email address, authentication identifiers from Clerk, organisation membership, and workspace settings. We also collect billing and subscription records from Stripe, support requests, audit logs, and product usage events.',
      'When you use Prymal, we process conversation data, workflow inputs and outputs, organisation knowledge uploaded into LORE, integration metadata, API key metadata, and operational telemetry required to keep the service secure and reliable.',
    ],
  },
  {
    heading: 'How we use your data',
    paragraphs: [
      'We use personal data to authenticate users, secure workspaces, deliver product functionality, enforce plan limits, process payments, support customer accounts, monitor abuse, and improve the platform. We also use limited analytics to understand which parts of Prymal are being adopted and where activation or retention can be improved.',
      'We do not sell customer data. Workspace content is processed only to provide the service, including agent responses, workflow execution, knowledge retrieval, and approved operational features such as integrations or live web research requested by the user.',
    ],
  },
  {
    heading: 'Processors and third parties',
    paragraphs: [
      'Prymal uses third-party providers including Clerk for authentication, Stripe for billing, infrastructure providers for hosting and storage, and AI model providers such as Anthropic and OpenAI to generate responses, run transcription, or perform other model-backed tasks requested within the product.',
      'Where third parties process customer content on our behalf, they do so under their own applicable terms and data processing commitments. We select processors that are appropriate for a commercial SaaS product and limit data sharing to what is required to provide the service.',
    ],
  },
  {
    heading: 'Retention, rights, and contact',
    paragraphs: [
      'We retain data for as long as needed to provide the service, comply with legal obligations, resolve disputes, enforce our agreements, and maintain platform security. Customers may request deletion of account and workspace data, subject to legal and operational limits.',
      'If you are in the UK or another jurisdiction with equivalent privacy rights, you may request access, correction, deletion, restriction, or portability of your data. Privacy requests can be sent to the Prymal support contact published on our site or in your workspace account communications.',
    ],
  },
];

export default function Privacy() {
  return (
    <LegalLayout
      eyebrow="Privacy policy"
      title="How Prymal handles account, workspace, and knowledge data."
      description="A plain-language overview of the data Prymal processes, why it is processed, and how that supports a secure UK-based AI SaaS platform."
      sections={sections}
      updated="5 April 2026"
      pageTitle="Prymal Privacy Policy | How we handle your data"
      canonicalPath="/privacy"
    />
  );
}

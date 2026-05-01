import {
  getEmailAppUrl,
  paragraph,
  renderEmailLayout,
  renderInfoCard,
  renderList,
  renderUsageSummary,
} from './email-layout.js';

const SIMPLE_CATALOGUE_URL = '/app/workflows/catalogue?mode=simple';

export const EMAIL_TEMPLATE_BUILDERS = {
  welcome: buildWelcomeEmail,
  'workflow-catalogue': buildWorkflowCatalogueEmail,
  'lore-starter': buildLoreStarterEmail,
  'team-invite': buildTeamInviteEmail,
  'subscription-started': buildSubscriptionStartedEmail,
  'subscription-updated': buildSubscriptionUpdatedEmail,
  'payment-failed': buildPaymentFailedEmail,
  'billing-receipt': buildBillingReceiptEmail,
  'credits-low': buildCreditsLowEmail,
  'usage-cap': buildUsageCapEmail,
  'workflow-installed': buildWorkflowInstalledEmail,
  'workflow-run-failed': buildWorkflowRunFailedEmail,
  'founder-access': buildFounderAccessEmail,
  'feedback-reply': buildFeedbackReplyEmail,
  'workspace-alert': buildWorkspaceAlertEmail,
};

export function renderTemplate(type, payload = {}) {
  const builder = EMAIL_TEMPLATE_BUILDERS[type];
  if (!builder) {
    throw new Error(`Unknown email template: ${type}`);
  }
  return builder(payload);
}

export function buildWelcomeEmail(_payload = {}) {
  const appUrl = getEmailAppUrl();
  const ctaUrl = `${appUrl}${SIMPLE_CATALOGUE_URL}`;
  const dashboardUrl = `${appUrl}/app/dashboard`;
  const title = 'Welcome to Prymal. Start with a proven workflow';
  const previewText = 'Your AI operating system is ready. Here is the fastest way to get value.';
  const bodyText = [
    'Welcome to Prymal.',
    '',
    'Prymal is built to help you move from prompts to execution. Instead of starting from a blank page, you can begin with proven workflows, specialist agents and your own business context.',
    '',
    'The fastest way to get value is to open the Workflow Catalogue and install a simple workflow. Start with content, sales, marketing, operations or support, then customise it around your business.',
    '',
    'What to try first:',
    '- Browse the Workflow Catalogue',
    '- Run a simple workflow',
    '- Add business context to LORE',
    '- Use agents for focused tasks',
    '- Turn repeatable tasks into workflows',
    '',
    'Usage note: Your plan includes execution credits and, where available, video credits. Running agents and workflows uses credits. You can monitor usage from billing settings.',
    '',
    'Reply with feedback any time. It helps shape the product.',
  ].join('\n');
  const bodyHtml = [
    paragraph('Welcome to Prymal.'),
    paragraph('Prymal is built to help you move from prompts to execution. Instead of starting from a blank page, you can begin with proven workflows, specialist agents and your own business context.'),
    paragraph('The fastest way to get value is to open the Workflow Catalogue and install a simple workflow. Start with content, sales, marketing, operations or support, then customise it around your business.'),
    renderInfoCard({ title: 'What to try first', body: renderList({ items: ['Browse the Workflow Catalogue', 'Run a simple workflow', 'Add business context to LORE', 'Use agents for focused tasks', 'Turn repeatable tasks into workflows'] }) }),
    paragraph('Usage note: Your plan includes execution credits and, where available, video credits. Running agents and workflows uses credits. You can monitor usage from billing settings.'),
  ].join('');
  return withLayout({ subject: title, previewText, title, bodyHtml, bodyText, cta: { label: 'Browse Workflow Catalogue', url: ctaUrl }, secondaryCta: { label: 'Open your dashboard', url: dashboardUrl } });
}

export function buildWorkflowCatalogueEmail() {
  const appUrl = getEmailAppUrl();
  const bodyText = [
    'Your first Prymal workflow is waiting.',
    '',
    'The Workflow Catalogue lets you start from a proven system instead of a blank page.',
    '',
    'Recommended first workflows:',
    '- 30-Day Content Engine',
    '- Website Audit Sprint',
    '- Sales Follow-Up Sequence',
    '- Support FAQ Generator',
    '- Pricing Margin Check',
    '',
    'Installing is free. Running workflows uses your normal Prymal credits.',
  ].join('\n');
  const bodyHtml = [
    paragraph('The Workflow Catalogue lets you start from a proven system instead of a blank page.'),
    renderInfoCard({ title: 'Recommended first workflows', body: renderList({ items: ['30-Day Content Engine', 'Website Audit Sprint', 'Sales Follow-Up Sequence', 'Support FAQ Generator', 'Pricing Margin Check'] }) }),
    paragraph('Installing is free. Running workflows uses your normal Prymal credits.'),
  ].join('');
  return withLayout({
    subject: 'Your first Prymal workflow is waiting',
    previewText: 'Start from a proven system instead of a blank page.',
    title: 'Your first Prymal workflow is waiting',
    bodyHtml,
    bodyText,
    cta: { label: 'Browse simple workflows', url: `${appUrl}${SIMPLE_CATALOGUE_URL}` },
    secondaryCta: { label: '30-Day Content Engine', url: `${appUrl}/app/workflows/catalogue/30-day-content-engine` },
  });
}

export function buildLoreStarterEmail() {
  const appUrl = getEmailAppUrl();
  const bodyText = [
    'LORE is the memory layer for Prymal.',
    '',
    'Add knowledge so agents and workflows can work from your real business information.',
    '',
    'Good first sources:',
    '- Brand voice',
    '- Services',
    '- FAQs',
    '- Pricing',
    '- Processes',
    '- Customer notes',
    '- Research',
    '',
    'Better context means better output.',
  ].join('\n');
  const bodyHtml = [
    paragraph('LORE is the memory layer for Prymal. Add knowledge so agents and workflows can work from your real business information.'),
    renderInfoCard({ title: 'Good first sources', body: renderList({ items: ['Brand voice', 'Services', 'FAQs', 'Pricing', 'Processes', 'Customer notes', 'Research'] }) }),
    paragraph('Better context means better output.'),
  ].join('');
  return withLayout({
    subject: 'Make Prymal smarter with your business context',
    previewText: 'Add knowledge to LORE so agents can work from your real information.',
    title: 'Make Prymal smarter with your business context',
    bodyHtml,
    bodyText,
    cta: { label: 'Add your first knowledge source', url: `${appUrl}/app/lore` },
  });
}

export function buildTeamInviteEmail({ workspaceName = 'a Prymal workspace', inviterName = 'A workspace admin', inviteUrl, role = 'member' } = {}) {
  const bodyText = [
    `${inviterName} invited you to join ${workspaceName} on Prymal as a ${role}.`,
    '',
    'In this workspace you can use agents, access shared workflows and work with LORE context.',
    '',
    'Only accept this invite if you expected it.',
  ].join('\n');
  const bodyHtml = [
    paragraph(`${inviterName} invited you to join ${workspaceName} on Prymal as a ${role}.`),
    renderInfoCard({ title: 'What you can do', body: renderList({ items: ['Use agents', 'Access shared workflows', 'Work with LORE context'] }) }),
    paragraph('Only accept this invite if you expected it.'),
  ].join('');
  return withLayout({
    subject: `You have been invited to join ${workspaceName} on Prymal`,
    previewText: 'Join the workspace and start working with agents, workflows and shared context.',
    title: `Join ${workspaceName} on Prymal`,
    bodyHtml,
    bodyText,
    cta: { label: 'Accept invitation', url: inviteUrl },
  });
}

export function buildSubscriptionStartedEmail(payload = {}) {
  const appUrl = getEmailAppUrl();
  const planName = payload.planName || 'Prymal';
  const bodyText = [
    `Your Prymal ${planName} plan is active.`,
    '',
    `Execution credits: ${payload.executionCredits ?? 'Included by plan'}`,
    `Video credits: ${payload.videoCredits ?? 'Available where included'}`,
    '',
    'You can view usage, manage billing and add credit packs from billing settings. Usage caps and add-ons are designed for predictable scaling.',
  ].join('\n');
  const bodyHtml = [
    paragraph(`Your Prymal ${planName} plan is active.`),
    renderUsageSummary({ planName, executionCredits: payload.executionCredits, videoCredits: payload.videoCredits }),
    paragraph('You can view usage, manage billing and add credit packs from billing settings. Usage caps and add-ons are designed for predictable scaling.'),
  ].join('');
  return withLayout({
    subject: `Your Prymal ${planName} plan is active`,
    previewText: 'Your workspace is ready with your new plan limits and credits.',
    title: `Your ${planName} plan is active`,
    bodyHtml,
    bodyText,
    cta: { label: 'View billing and usage', url: `${appUrl}/app/settings?tab=billing` },
  });
}

export function buildSubscriptionUpdatedEmail(payload = {}) {
  const appUrl = getEmailAppUrl();
  const oldPlan = payload.oldPlanName ? `Previous plan: ${payload.oldPlanName}\n` : '';
  const bodyText = [
    'Your workspace plan and usage limits have changed.',
    '',
    oldPlan + `New plan: ${payload.planName || 'Prymal'}`,
    `Effective date: ${formatDate(payload.effectiveDate)}`,
    '',
    'Open billing settings to review current credits, invoices and plan controls.',
  ].join('\n');
  const bodyHtml = [
    paragraph('Your workspace plan and usage limits have changed.'),
    renderInfoCard({ title: 'Plan update', body: `${oldPlan ? `${oldPlan}<br>` : ''}New plan: ${payload.planName || 'Prymal'}<br>Effective date: ${formatDate(payload.effectiveDate)}` }),
    paragraph('Open billing settings to review current credits, invoices and plan controls.'),
  ].join('');
  return withLayout({
    subject: 'Your Prymal plan has been updated',
    previewText: 'Your workspace plan and usage limits have changed.',
    title: 'Your Prymal plan has been updated',
    bodyHtml,
    bodyText,
    cta: { label: 'View billing and usage', url: `${appUrl}/app/settings?tab=billing` },
  });
}

export function buildPaymentFailedEmail({ billingPortalUrl } = {}) {
  const appUrl = getEmailAppUrl();
  const bodyText = [
    'Your latest Prymal payment did not go through.',
    '',
    'Please update your billing details to keep your workspace active. If you need help, reply to this email and the Prymal team will take a look.',
  ].join('\n');
  const bodyHtml = [
    paragraph('Your latest Prymal payment did not go through.'),
    paragraph('Please update your billing details to keep your workspace active. If you need help, reply to this email and the Prymal team will take a look.'),
  ].join('');
  return withLayout({
    subject: 'Action needed: your Prymal payment did not go through',
    previewText: 'Please update your billing details to keep your workspace active.',
    title: 'Action needed: payment failed',
    bodyHtml,
    bodyText,
    cta: { label: 'Update payment method', url: billingPortalUrl || `${appUrl}/app/settings?tab=billing` },
  });
}

export function buildBillingReceiptEmail(payload = {}) {
  const appUrl = getEmailAppUrl();
  const amount = payload.amount || 'your payment';
  const bodyText = [
    `Your payment for ${payload.planName || 'Prymal'} has been received.`,
    '',
    `Amount: ${amount}`,
    `Invoice date: ${formatDate(payload.invoiceDate)}`,
    payload.invoiceUrl ? `Invoice: ${payload.invoiceUrl}` : '',
  ].filter(Boolean).join('\n');
  const bodyHtml = [
    paragraph(`Your payment for ${payload.planName || 'Prymal'} has been received.`),
    renderInfoCard({ title: 'Receipt', body: `Amount: ${amount}<br>Invoice date: ${formatDate(payload.invoiceDate)}${payload.invoiceUrl ? `<br>Invoice: ${payload.invoiceUrl}` : ''}` }),
  ].join('');
  return withLayout({
    subject: `Your Prymal receipt for ${amount}`,
    previewText: `Your payment for ${payload.planName || 'Prymal'} has been received.`,
    title: 'Your Prymal receipt',
    bodyHtml,
    bodyText,
    cta: { label: 'View billing', url: `${appUrl}/app/settings?tab=billing` },
  });
}

export function buildCreditsLowEmail(payload = {}) {
  const appUrl = getEmailAppUrl();
  const threshold = payload.thresholdPercent ?? 70;
  const bodyText = [
    `Your Prymal workspace has reached about ${threshold}% of its plan usage for this billing period.`,
    '',
    `Plan: ${payload.planName || 'Prymal'}`,
    '',
    'You can review usage, add credits or adjust your plan from billing settings.',
  ].join('\n');
  const bodyHtml = [
    paragraph(`Your Prymal workspace has reached about ${threshold}% of its plan usage for this billing period.`),
    renderInfoCard({ title: 'Usage status', body: `Plan: ${payload.planName || 'Prymal'}<br>Threshold: ${threshold}%` }),
    paragraph('You can review usage, add credits or adjust your plan from billing settings.'),
  ].join('');
  return withLayout({
    subject: 'Your Prymal credits are running low',
    previewText: 'You are approaching your plan usage limit for this billing period.',
    title: 'Your Prymal credits are running low',
    bodyHtml,
    bodyText,
    cta: { label: 'View usage', url: `${appUrl}/app/settings?tab=billing` },
    secondaryCta: { label: 'Add credits', url: `${appUrl}/app/settings?tab=billing` },
  });
}

export function buildUsageCapEmail(payload = {}) {
  const appUrl = getEmailAppUrl();
  const bodyText = [
    'Your Prymal usage limit has been reached.',
    '',
    'Some runs may pause until credits are added or your billing period resets.',
    '',
    'Your existing data, workflows and workspace settings are safe.',
  ].join('\n');
  const bodyHtml = [
    paragraph('Your Prymal usage limit has been reached.'),
    renderInfoCard({ title: 'Your options', body: renderList({ items: ['Add credits', 'Wait for reset', 'Upgrade plan'] }) }),
    paragraph('Your existing data, workflows and workspace settings are safe.'),
  ].join('');
  return withLayout({
    subject: 'Your Prymal usage limit has been reached',
    previewText: 'Some runs may pause until credits are added or your billing period resets.',
    title: 'Your Prymal usage limit has been reached',
    bodyHtml,
    bodyText,
    cta: { label: 'View usage options', url: payload.url || `${appUrl}/app/settings?tab=billing` },
  });
}

export function buildWorkflowInstalledEmail(payload = {}) {
  const appUrl = getEmailAppUrl();
  const workflowTitle = payload.workflowTitle || 'your workflow';
  const workflowUrl = payload.workflowUrl || `${appUrl}/app/workflows${payload.workflowId ? `?workflow=${payload.workflowId}` : ''}`;
  const bodyText = [
    `Your workflow is ready: ${workflowTitle}`,
    '',
    'Next steps:',
    '- Review the inputs',
    '- Customise the workflow',
    '- Run it when you are ready',
    '',
    'Running this workflow uses your normal Prymal credits.',
  ].join('\n');
  const bodyHtml = [
    paragraph(`Your workflow is ready: ${workflowTitle}`),
    renderInfoCard({ title: 'Next steps', body: renderList({ items: ['Review the inputs', 'Customise the workflow', 'Run it when you are ready'] }) }),
    paragraph('Running this workflow uses your normal Prymal credits.'),
  ].join('');
  return withLayout({
    subject: `Your workflow is ready: ${workflowTitle}`,
    previewText: 'You can now customise it, run it, or build on top of it.',
    title: 'Your workflow is ready',
    bodyHtml,
    bodyText,
    cta: { label: 'Open workflow', url: workflowUrl },
  });
}

export function buildWorkflowRunFailedEmail(payload = {}) {
  const appUrl = getEmailAppUrl();
  const bodyText = [
    `${payload.workflowName || 'A Prymal workflow'} could not complete successfully.`,
    '',
    `Failure summary: ${payload.failureSummary || 'The run failed after retry handling.'}`,
    `Time: ${formatDate(payload.failedAt)}`,
    '',
    'Open the workflow run to review details and decide the next step.',
  ].join('\n');
  const bodyHtml = [
    paragraph(`${payload.workflowName || 'A Prymal workflow'} could not complete successfully.`),
    renderInfoCard({ title: 'Run details', body: `Failure summary: ${payload.failureSummary || 'The run failed after retry handling.'}<br>Time: ${formatDate(payload.failedAt)}` }),
    paragraph('Open the workflow run to review details and decide the next step.'),
  ].join('');
  return withLayout({
    subject: 'A Prymal workflow needs your attention',
    previewText: 'One of your workflow runs could not complete successfully.',
    title: 'A Prymal workflow needs your attention',
    bodyHtml,
    bodyText,
    cta: { label: 'Review workflow run', url: payload.workflowRunId ? `${appUrl}/app/workflows/runs/${payload.workflowRunId}` : `${appUrl}/app/workflows` },
  });
}

export function buildFounderAccessEmail(payload = {}) {
  const appUrl = getEmailAppUrl();
  const bodyText = [
    'Founder Access is active on your Prymal workspace.',
    '',
    'Your early-access benefits are now applied. Standard monthly usage allowances still apply.',
    payload.founderPeriodEndsAt ? `Founder window ends: ${formatDate(payload.founderPeriodEndsAt)}` : '',
    payload.onboardingBonusCredits ? `Onboarding execution bonus: ${payload.onboardingBonusCredits} credits` : '',
  ].filter(Boolean).join('\n');
  const bodyHtml = [
    paragraph('Founder Access is active on your Prymal workspace.'),
    paragraph('Your early-access benefits are now applied. Standard monthly usage allowances still apply.'),
    renderInfoCard({ title: 'Founder Access', body: `${payload.founderPeriodEndsAt ? `Founder window ends: ${formatDate(payload.founderPeriodEndsAt)}<br>` : ''}${payload.onboardingBonusCredits ? `Onboarding execution bonus: ${payload.onboardingBonusCredits} credits` : 'Benefits are applied to this workspace.'}` }),
  ].join('');
  return withLayout({
    subject: 'Founder Access is active on your Prymal workspace',
    previewText: 'Your early-access benefits are now applied.',
    title: 'Founder Access is active',
    bodyHtml,
    bodyText,
    cta: { label: 'Open Prymal', url: `${appUrl}/app/dashboard` },
  });
}

export function buildFeedbackReplyEmail() {
  const appUrl = getEmailAppUrl();
  const bodyText = [
    'Thanks for helping shape Prymal.',
    '',
    'Your feedback has been received by the Prymal team. It helps improve workflows, agents and onboarding.',
    '',
    'Keep sending feedback as you use the product.',
  ].join('\n');
  const bodyHtml = [
    paragraph('Thanks for helping shape Prymal.'),
    paragraph('Your feedback has been received by the Prymal team. It helps improve workflows, agents and onboarding.'),
    paragraph('Keep sending feedback as you use the product.'),
  ].join('');
  return withLayout({
    subject: 'Thanks for helping shape Prymal',
    previewText: 'Your feedback has been received by the Prymal team.',
    title: 'Thanks for helping shape Prymal',
    bodyHtml,
    bodyText,
    cta: { label: 'Open Prymal', url: `${appUrl}/app/dashboard` },
    footerNote: 'Reply to this email and it will reach the Prymal team.',
  });
}

export function buildWorkspaceAlertEmail(payload = {}) {
  const appUrl = getEmailAppUrl();
  const bodyText = [
    `Event: ${payload.eventName || 'Workspace update'}`,
    payload.actorName ? `Triggered by: ${payload.actorName}` : '',
    `Time: ${formatDate(payload.occurredAt)}`,
    payload.actionRequired ? `Action required: ${payload.actionRequired}` : 'No immediate action is required.',
  ].filter(Boolean).join('\n');
  const bodyHtml = [
    renderInfoCard({ title: payload.eventName || 'Workspace update', body: `${payload.actorName ? `Triggered by: ${payload.actorName}<br>` : ''}Time: ${formatDate(payload.occurredAt)}<br>${payload.actionRequired ? `Action required: ${payload.actionRequired}` : 'No immediate action is required.'}` }),
  ].join('');
  return withLayout({
    subject: 'Important update for your Prymal workspace',
    previewText: 'A workspace setting or connection has changed.',
    title: 'Important workspace update',
    bodyHtml,
    bodyText,
    cta: { label: 'Review workspace settings', url: `${appUrl}/app/settings` },
  });
}

function withLayout({ subject, previewText, title, bodyHtml, bodyText, cta, secondaryCta, footerNote }) {
  const rendered = renderEmailLayout({ title, previewText, bodyHtml, bodyText, cta, secondaryCta, footerNote });
  return { subject, previewText, html: rendered.html, text: rendered.text };
}

function formatDate(value) {
  if (!value) return new Date().toLocaleString('en-GB');
  return new Date(value).toLocaleString('en-GB');
}

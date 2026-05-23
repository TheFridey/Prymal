/**
 * Configurable time-saved estimates for the dashboard.
 * All weights live here — do not duplicate minutes assumptions in UI components.
 */

export const TIME_SAVED_WEIGHTS = {
  agentChatCompleted: 10,
  workflowRunCompleted: 35,
  generatedReportOrAudit: 45,
  contentOrCampaignOutput: 30,
  imageOrVideoGeneration: 20,
};

export const DEFAULT_HOURLY_RATE_GBP = 35;

const WEEK_OF_MONTH_RATIO = 0.35;

function toCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/**
 * @param {object} input
 * @param {number} [input.conversations]
 * @param {number} [input.workflowRuns]
 * @param {number} [input.loreDocuments]
 * @param {number} [input.contentAssets]
 * @param {number} [input.reportsOrAudits]
 * @param {number} [input.mediaGenerations]
 * @param {number} [input.hourlyRateGbp]
 */
export function estimateTimeSaved(input = {}) {
  const conversations = toCount(input.conversations);
  const workflowRuns = toCount(input.workflowRuns);
  const loreDocuments = toCount(input.loreDocuments);
  const contentAssets = toCount(input.contentAssets);
  const reportsOrAudits = toCount(input.reportsOrAudits);
  const mediaGenerations = toCount(input.mediaGenerations);
  const hourlyRateGbp = Number(input.hourlyRateGbp) > 0
    ? Number(input.hourlyRateGbp)
    : DEFAULT_HOURLY_RATE_GBP;

  const breakdown = {
    agentChats: conversations * TIME_SAVED_WEIGHTS.agentChatCompleted,
    workflowRuns: workflowRuns * TIME_SAVED_WEIGHTS.workflowRunCompleted,
    reports: reportsOrAudits * TIME_SAVED_WEIGHTS.generatedReportOrAudit,
    content: contentAssets * TIME_SAVED_WEIGHTS.contentOrCampaignOutput,
    lore: loreDocuments * Math.round(TIME_SAVED_WEIGHTS.agentChatCompleted * 0.6),
    media: mediaGenerations * TIME_SAVED_WEIGHTS.imageOrVideoGeneration,
  };

  const minutesMonth = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const minutesWeek = minutesMonth > 0
    ? Math.min(minutesMonth, Math.round(minutesMonth * WEEK_OF_MONTH_RATIO))
    : 0;

  const completedTasks = conversations + workflowRuns + contentAssets + reportsOrAudits + mediaGenerations;
  const isEmpty = minutesMonth === 0;
  const savedHours = minutesMonth / 60;
  const estimatedValueGbp = isEmpty ? 0 : Math.round(savedHours * hourlyRateGbp);

  return {
    minutesWeek,
    minutesMonth,
    completedTasks,
    workflowsRun: workflowRuns,
    savedHours,
    estimatedValueGbp,
    isEmpty,
    breakdown,
    hourlyRateGbp,
    isWeekEstimate: true,
  };
}

export function formatSavedMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '0m';
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function buildTimeSavedInputFromViewer(viewer = {}, billingStats = null) {
  const stats = viewer?.stats ?? {};
  const billing = billingStats ?? {};

  return {
    conversations: billing.conversations ?? stats.conversationCount ?? 0,
    workflowRuns: billing.workflowRuns ?? 0,
    loreDocuments: billing.loreDocuments ?? stats.loreDocuments ?? 0,
    contentAssets: billing.contentAssets ?? stats.contentAssets ?? 0,
    reportsOrAudits: stats.feedbackEvents ?? 0,
    mediaGenerations: 0,
  };
}

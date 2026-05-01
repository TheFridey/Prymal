import { detectPromptInjection } from './prompt-injection-detector.js';
import { WARDEN_CATEGORIES, WARDEN_RISK_LEVELS, WARDEN_VERDICTS } from './warden-policy.js';

const MINOR_TERMS_RE = /\b(child|children|minor|underage|teen|teenager|schoolgirl|schoolboy|preteen|kid|young-looking|young looking|lolita|loli|legal teen|young but 18|looks underage|childlike adult|petite schoolgirl|youth coded)\b/i;
const SEXUAL_TERMS_RE = /\b(sex|sexual|sexuali[sz](?:e|ed|ing)?|nude|naked|porn|erotic|fetish|seductive|lingerie|explicit|strip|upskirt|non-consensual|nonconsensual|rape|sexual violence)\b/i;
const CSAM_RE = /\b(csam|child sexual|underage porn|minor nude|teen porn|schoolgirl porn|schoolboy porn)\b/i;
const HATE_EXTREMISM_RE = /\b(swastika|nazi propaganda|kkk|white power|racial extermination|gas the|dehumaniz(?:e|ing)|terrorist propaganda|isis propaganda|extremist recruitment|anti-[a-z\s-]+propaganda|vermin|rats|cockroaches|animals)\b/i;
const ILLEGAL_HARM_RE = /\b(build a bomb|make explosives|weapon manufacturing|credit card skimmer|fake id|counterfeit passport|meth lab|bypass model safety|jailbreak image model)\b/i;
const IMAGE_OCR_FOLLOW_RE = /\b(?:ocr|read text in|text hidden in).*?\b(?:follow|run|execute|obey)\b/i;
const SUSPICIOUS_EUPHEMISMS_RE = /\b(barely legal|legal teen|young but 18|young but legal|young model|teen style|school aesthetic|innocent school aesthetic|childlike adult|petite schoolgirl|loli|lolita|youth coded|make (?:her|him|them) look younger|looks underage)\b/i;
const NEUTRAL_DOCUMENTARY_RE = /\b(documentary|educational|historical analysis|museum|news report|anti-hate|counter(?:speech|ing)|criticis(?:e|m)|critique|non-glorifying|not glorifying)\b/i;
const GLORIFICATION_RE = /\b(glorify|glorifying|recruitment|propaganda|praise|celebrate|heroic|make .* look powerful)\b/i;

export function classifyMediaPromptSafety({ prompt = '', uploadedImageText = '', imageMetadata = {} } = {}) {
  const combined = [prompt, uploadedImageText].filter(Boolean).join('\n\n');
  const categories = [];
  const reasons = [];

  if (CSAM_RE.test(combined) || (MINOR_TERMS_RE.test(combined) && SEXUAL_TERMS_RE.test(combined))) {
    categories.push(WARDEN_CATEGORIES.MEDIA_ILLEGAL_SEXUAL);
    reasons.push('The media request appears to sexualise minors or young-looking people.');
  }

  if (SUSPICIOUS_EUPHEMISMS_RE.test(combined)) {
    categories.push(WARDEN_CATEGORIES.MEDIA_ILLEGAL_SEXUAL);
    reasons.push('Suspicious euphemistic phrasing detected.');
  }

  if (/\b(non-consensual|nonconsensual|rape|sexual violence|revenge porn)\b/i.test(combined)) {
    categories.push(WARDEN_CATEGORIES.MEDIA_ILLEGAL_SEXUAL);
    reasons.push('The media request appears to involve non-consensual sexual imagery or sexual violence.');
  }

  if (HATE_EXTREMISM_RE.test(combined) && (!NEUTRAL_DOCUMENTARY_RE.test(combined) || GLORIFICATION_RE.test(combined))) {
    categories.push(WARDEN_CATEGORIES.MEDIA_HATE_EXTREMISM);
    reasons.push('The media request appears to request hateful, extremist, or dehumanising propaganda imagery.');
  }

  if (ILLEGAL_HARM_RE.test(combined)) {
    categories.push(WARDEN_CATEGORIES.MEDIA_ILLEGAL_HARM);
    reasons.push('The media request appears to materially facilitate illegal or harmful activity.');
  }

  if (IMAGE_OCR_FOLLOW_RE.test(combined)) {
    categories.push(WARDEN_CATEGORIES.PROVIDER_JAILBREAK);
    reasons.push('The request asks Prymal to follow instructions found inside an image.');
  }

  const injection = detectPromptInjection(combined);
  if (injection.detected) {
    categories.push(...injection.categories);
    reasons.push(...injection.reasons);
  }

  const blocked = categories.some((category) => [
    WARDEN_CATEGORIES.MEDIA_ILLEGAL_SEXUAL,
    WARDEN_CATEGORIES.MEDIA_HATE_EXTREMISM,
    WARDEN_CATEGORIES.MEDIA_ILLEGAL_HARM,
  ].includes(category));

  return {
    verdict: blocked ? WARDEN_VERDICTS.BLOCK : injection.detected ? WARDEN_VERDICTS.ALLOW_WITH_SANDBOX : WARDEN_VERDICTS.ALLOW,
    riskLevel: blocked ? WARDEN_RISK_LEVELS.CRITICAL : injection.detected ? WARDEN_RISK_LEVELS.HIGH : WARDEN_RISK_LEVELS.LOW,
    categories: [...new Set(categories)],
    reasons,
    imageMetadata,
  };
}

export function buildMediaRefusalMessage(decision) {
  if (decision.categories?.includes(WARDEN_CATEGORIES.MEDIA_ILLEGAL_SEXUAL)) {
    return "I can't help create that image or video.";
  }

  if (decision.categories?.includes(WARDEN_CATEGORIES.MEDIA_HATE_EXTREMISM)) {
    return "I can't help create hateful or extremist imagery.";
  }

  if (decision.categories?.includes(WARDEN_CATEGORIES.MEDIA_ILLEGAL_HARM)) {
    return "I can't help create media that would materially support illegal harm.";
  }

  return "I can't run that media request safely.";
}

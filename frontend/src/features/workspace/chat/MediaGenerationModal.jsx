import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, InlineNotice } from '../../../components/ui';
import { CloseIcon } from './icons';
import {
  IMAGE_BACKGROUND_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
  IMAGE_SIZE_OPTIONS,
  VIDEO_MODE_OPTIONS,
  buildVideoConfirmCopy,
  createImageGenerationDraft,
  createVideoGenerationDraft,
  estimateImageExecutionCredits,
  estimatePromptTokens,
  estimateVideoCredits,
  getVideoModeConfig,
  shouldConfirmVideoRender,
} from './media-generation';
import { convertImageFileToWebpPayload } from './imageUpload';

const MAX_REFERENCE_IMAGES = 3;
const MAX_REFERENCE_IMAGE_BYTES = 2 * 1024 * 1024;

export default function MediaGenerationModal({
  kind,
  activeAgent,
  initialDraft,
  onClose,
  onSubmit,
  isSubmitting = false,
}) {
  const isVideo = kind === 'video';
  const [draft, setDraft] = useState(() =>
    isVideo ? createVideoGenerationDraft(initialDraft) : createImageGenerationDraft(initialDraft),
  );
  const [referenceError, setReferenceError] = useState('');
  const [confirmStage, setConfirmStage] = useState(false);
  const referenceInputRef = useRef(null);

  useEffect(() => {
    setDraft(isVideo ? createVideoGenerationDraft(initialDraft) : createImageGenerationDraft(initialDraft));
    setReferenceError('');
    setConfirmStage(false);
  }, [initialDraft, isVideo]);

  const videoMode = useMemo(
    () => (isVideo ? getVideoModeConfig(draft.mode) : null),
    [draft.mode, isVideo],
  );
  const promptTokens = estimatePromptTokens(draft.prompt);
  const estimatedCredits = isVideo
    ? estimateVideoCredits({
      mode: draft.mode,
      durationSeconds: draft.durationSeconds,
      resolution: draft.resolution,
    })
    : estimateImageExecutionCredits({ quality: draft.quality });
  const requiresEightSecondReferenceRender = Boolean(
    isVideo
      && videoMode?.supportsReferenceImages
      && draft.referenceImages?.length > 0
      && videoMode.referenceImagesRequireDuration
      && Number(draft.durationSeconds) !== Number(videoMode.referenceImagesRequireDuration),
  );
  const negativePromptLocked = Boolean(isVideo && (draft.referenceImages?.length ?? 0) > 0);
  const negativePromptEnabled = isVideo && !negativePromptLocked && draft.useNegativePrompt !== false;

  const submitDisabled = isSubmitting
    || !String(draft.prompt ?? '').trim()
    || Boolean(referenceError)
    || requiresEightSecondReferenceRender;
  const confirmNeeded = isVideo
    && shouldConfirmVideoRender({
      mode: draft.mode,
      resolution: draft.resolution,
      estimatedCredits,
    });
  const confirmCopy = isVideo && confirmStage
    ? buildVideoConfirmCopy({
      mode: draft.mode,
      durationSeconds: draft.durationSeconds,
      resolution: draft.resolution,
      referenceImageCount: draft.referenceImages?.length ?? 0,
      estimatedCredits,
    })
    : null;
  const videoSummaryItems = isVideo
    ? [
      { label: 'Mode', value: videoMode.label },
      { label: 'Provider lane', value: videoMode.providerLabel },
      { label: 'Duration', value: `${draft.durationSeconds}s` },
      { label: 'Resolution', value: draft.resolution },
      { label: 'Aspect', value: draft.aspectRatio },
      { label: 'References', value: String(draft.referenceImages?.length ?? 0) },
    ]
    : [];

  function updateDraft(patch) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function handleVideoModeChange(nextMode) {
    const nextConfig = getVideoModeConfig(nextMode);
    setDraft((current) => {
      const nextReferenceImages = nextConfig.supportsReferenceImages ? current.referenceImages : [];
      return {
        ...current,
        mode: nextMode,
        durationSeconds: nextConfig.supportedDurations.includes(Number(current.durationSeconds))
          ? Number(current.durationSeconds)
          : nextConfig.supportedDurations[0],
        resolution: nextConfig.supportedResolutions.includes(current.resolution)
          ? current.resolution
          : nextConfig.supportedResolutions[0],
        aspectRatio: nextConfig.supportedAspectRatios.includes(current.aspectRatio)
          ? current.aspectRatio
          : nextConfig.supportedAspectRatios[0],
        referenceImages: nextReferenceImages,
        useNegativePrompt: nextReferenceImages.length > 0 ? false : current.useNegativePrompt,
      };
    });
    setReferenceError('');
  }

  function handleReferenceFiles(event) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    if (!videoMode?.supportsReferenceImages) {
      setReferenceError('Reference images are only available in Standard mode.');
      event.target.value = '';
      return;
    }

    const remainingSlots = MAX_REFERENCE_IMAGES - (draft.referenceImages?.length ?? 0);
    if (remainingSlots <= 0) {
      setReferenceError(`You can attach up to ${MAX_REFERENCE_IMAGES} reference images.`);
      event.target.value = '';
      return;
    }

    const nextFiles = files.slice(0, remainingSlots);
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

    Promise.all(
      nextFiles.map(
        (file) =>
          new Promise((resolve, reject) => {
            if (!allowedTypes.has(file.type)) {
              reject(new Error('Reference images must be PNG, JPEG, or WEBP files.'));
              return;
            }

            if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
              reject(new Error('Each reference image must be under 2 MB.'));
              return;
            }

            convertImageFileToWebpPayload(file)
              .then((payload) => resolve(payload))
              .catch(() => reject(new Error(`Could not convert ${file.name} to WEBP.`)));
          }),
      ),
    )
      .then((images) => {
        setDraft((current) => {
          const nextReferenceImages = [...(current.referenceImages ?? []), ...images];
          return {
            ...current,
            referenceImages: nextReferenceImages,
            useNegativePrompt: nextReferenceImages.length > 0 ? false : current.useNegativePrompt,
          };
        });
        setReferenceError('');
      })
      .catch((error) => {
        setReferenceError(error.message || 'Reference images could not be added.');
      })
      .finally(() => {
        event.target.value = '';
      });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitDisabled) {
      return;
    }

    if (isVideo && confirmNeeded && !confirmStage) {
      setConfirmStage(true);
      return;
    }

    await onSubmit({
      ...draft,
      prompt: String(draft.prompt ?? '').trim(),
      durationSeconds: Number(draft.durationSeconds),
      referenceImages: draft.referenceImages ?? [],
      useNegativePrompt: isVideo ? negativePromptEnabled : undefined,
    });
  }

  const title = isVideo ? `${activeAgent.name} video brief` : `${activeAgent.name} image brief`;
  const eyebrow = isVideo ? 'Video generation' : 'Image generation';

  return (
    <div className="workspace-modal-backdrop" onClick={onClose}>
      <div className="workspace-modal" onClick={(event) => event.stopPropagation()}>
        <div className="workspace-modal__header">
          <div>
            <div className="workspace-modal__eyebrow">{eyebrow}</div>
            <h2 className="workspace-modal__title">{title}</h2>
          </div>
          <button
            type="button"
            className="workspace-studio__ghost-icon"
            onClick={onClose}
            aria-label={`Close ${eyebrow.toLowerCase()}`}
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '18px' }}>
          {isVideo ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '10px',
              }}
            >
              {Object.values(VIDEO_MODE_OPTIONS).map((mode) => {
                const isActive = mode.id === draft.mode;
                const previewCredits = estimateVideoCredits({
                  mode: mode.id,
                  durationSeconds: Number(draft.durationSeconds) || mode.supportedDurations[0],
                  resolution: mode.supportedResolutions.includes(draft.resolution) ? draft.resolution : mode.supportedResolutions[0],
                });
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleVideoModeChange(mode.id)}
                    aria-pressed={isActive}
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      background: isActive ? 'rgba(124, 224, 195, 0.14)' : 'rgba(255,255,255,0.03)',
                      border: isActive ? '1px solid rgba(124, 224, 195, 0.55)' : '1px solid rgba(255,255,255,0.08)',
                      color: 'var(--text-strong)',
                      display: 'grid',
                      gap: '6px',
                    }}
                    title={mode.id === 'standard'
                      ? 'Standard is best for polished renders and reference-led videos. Higher credit burn.'
                      : 'Lite is best for quick drafts and simple promos. Lower credit burn.'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '14px' }}>{mode.label}</strong>
                      <span
                        style={{
                          fontSize: '11px',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: mode.id === 'standard' ? 'rgba(255, 196, 111, 0.2)' : 'rgba(105, 188, 255, 0.18)',
                          color: mode.id === 'standard' ? 'rgb(255, 196, 111)' : 'rgb(105, 188, 255)',
                        }}
                      >
                        {mode.id === 'standard' ? 'higher burn' : 'lower burn'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
                      {mode.id === 'standard'
                        ? 'Higher-quality Veo lane. Supports reference images on 8s renders. Heavier credit burn because the provider costs more.'
                        : 'Faster, lower-credit draft lane. Great for quick concepts and simple promo passes.'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {mode.providerLabel} — approx. {previewCredits} credits at current settings
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="workspace-modal__grid">

            {isVideo ? (
              <label className="workspace-modal__field">
                <span>Duration</span>
                <select
                  value={draft.durationSeconds}
                  onChange={(event) => updateDraft({ durationSeconds: Number(event.target.value) })}
                  className="field"
                >
                  {videoMode.supportedDurations.map((duration) => (
                    <option key={duration} value={duration}>{duration}s</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="workspace-modal__field">
                <span>Size</span>
                <select
                  value={draft.size}
                  onChange={(event) => updateDraft({ size: event.target.value })}
                  className="field"
                >
                  {IMAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            )}

            {isVideo ? (
              <label className="workspace-modal__field">
                <span>Resolution</span>
                <select
                  value={draft.resolution}
                  onChange={(event) => updateDraft({ resolution: event.target.value })}
                  className="field"
                >
                  {videoMode.supportedResolutions.map((resolution) => (
                    <option key={resolution} value={resolution}>{resolution}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="workspace-modal__field">
                <span>Quality</span>
                <select
                  value={draft.quality}
                  onChange={(event) => updateDraft({ quality: event.target.value })}
                  className="field"
                >
                  {IMAGE_QUALITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            )}

            {isVideo ? (
              <label className="workspace-modal__field">
                <span>Aspect ratio</span>
                <select
                  value={draft.aspectRatio}
                  onChange={(event) => updateDraft({ aspectRatio: event.target.value })}
                  className="field"
                >
                  {videoMode.supportedAspectRatios.map((aspectRatio) => (
                    <option key={aspectRatio} value={aspectRatio}>{aspectRatio}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="workspace-modal__field">
                <span>Background</span>
                <select
                  value={draft.background}
                  onChange={(event) => updateDraft({ background: event.target.value })}
                  className="field"
                >
                  {IMAGE_BACKGROUND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="workspace-modal__field workspace-modal__field--full">
              <span>{isVideo ? 'Video brief' : 'Image brief'}</span>
              <textarea
                value={draft.prompt}
                onChange={(event) => updateDraft({ prompt: event.target.value })}
                className="field field--textarea"
                rows={6}
                placeholder={
                  isVideo
                    ? 'Describe the scenes, movement, pacing, and what the render should feel like.'
                    : 'Describe the visual, framing, brand direction, and what the image should communicate.'
                }
              />
            </label>
          </div>

          {isVideo ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              <InlineNotice tone="default">
                {videoMode.description} Google&apos;s current Veo API still limits one-shot renders to 4, 6, or 8 seconds.
              </InlineNotice>
              {draft.mode === 'standard' ? (
                <InlineNotice tone="default">
                  Standard uses more credits because it costs more to render. It is the higher-quality Veo lane and the only option that supports reference images in Prymal.
                </InlineNotice>
              ) : (
                <InlineNotice tone="default">
                  Lite is the faster, lower-credit draft lane. It is best for quick concepts and simple promo passes.
                </InlineNotice>
              )}

              <div
                style={{
                  display: 'grid',
                  gap: '12px',
                  padding: '16px 18px',
                  borderRadius: '18px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-strong)' }}>Reference images</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
                      Reference images require Standard mode and an 8 second render. PNG, JPEG, and WEBP uploads are converted to WEBP before rendering.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => referenceInputRef.current?.click()}
                      disabled={!videoMode.supportsReferenceImages || (draft.referenceImages?.length ?? 0) >= MAX_REFERENCE_IMAGES}
                    >
                      Add images
                    </button>
                    <input
                      ref={referenceInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      style={{ display: 'none' }}
                      onChange={handleReferenceFiles}
                    />
                  </div>
                </div>

                {draft.referenceImages?.length > 0 ? (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {draft.referenceImages.map((image, index) => (
                      <div
                        key={`${image.name}-${index}`}
                        style={{
                          position: 'relative',
                          width: 88,
                          height: 88,
                          borderRadius: '14px',
                          overflow: 'hidden',
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: 'rgba(255,255,255,0.04)',
                        }}
                      >
                        <img
                          src={image.previewUrl}
                          alt={image.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        <button
                          type="button"
                          aria-label={`Remove ${image.name}`}
                          onClick={() =>
                            updateDraft({
                              referenceImages: draft.referenceImages.filter((_, imageIndex) => imageIndex !== index),
                            })}
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            width: 24,
                            height: 24,
                            borderRadius: '999px',
                            border: 'none',
                            background: 'rgba(4, 8, 20, 0.7)',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {referenceError ? <InlineNotice tone="danger">{referenceError}</InlineNotice> : null}
                {requiresEightSecondReferenceRender ? (
                  <InlineNotice tone="warning">
                    Reference images require an 8 second Standard render. Adjust the duration before generating.
                  </InlineNotice>
                ) : null}
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: '10px',
                  padding: '16px 18px',
                  borderRadius: '18px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  opacity: negativePromptLocked ? 0.75 : 1,
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    cursor: negativePromptLocked ? 'not-allowed' : 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={negativePromptEnabled}
                    disabled={negativePromptLocked}
                    onChange={(event) => updateDraft({ useNegativePrompt: event.target.checked })}
                    style={{ marginTop: 4 }}
                  />
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-strong)' }}>
                      Quality guardrails (negative prompt)
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
                      Steers Veo away from cluttered UI, garbled text, mascots, glitch effects, and other low-quality looks. Recommended on for promo renders.
                    </span>
                  </div>
                </label>
                {negativePromptLocked ? (
                  <InlineNotice tone="warning">
                    Negative prompts are not supported by Veo when reference images are attached. Remove the references to re-enable guardrails.
                  </InlineNotice>
                ) : null}
              </div>
            </div>
          ) : null}

          <div
            style={{
              display: 'grid',
              gap: '10px',
              padding: '14px 16px',
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  Approx. prompt tokens
                </div>
                <div style={{ fontSize: '18px', color: 'var(--text-strong)', fontWeight: 700 }}>{promptTokens}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  Estimated {isVideo ? 'AI video credits' : 'execution credits'}
                </div>
                <div style={{ fontSize: '18px', color: 'var(--text-strong)', fontWeight: 700 }}>{estimatedCredits}</div>
              </div>
            </div>
            {isVideo ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                  gap: '10px',
                }}
              >
                {videoSummaryItems.map((item) => (
                  <div key={item.label}>
                    <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-strong)', fontWeight: 600 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            ) : null}
            <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
              Prompt tokens are a rough text-only estimate for your brief. Billing, queue checks, and final burn remain server-side authoritative.
            </div>
          </div>

          <div className="workspace-modal__footer">
            {confirmCopy ? (
              <InlineNotice tone="warning">
                <div style={{ display: 'grid', gap: '4px' }}>
                  <strong>{confirmCopy.headline}</strong>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{confirmCopy.detail}</span>
                </div>
              </InlineNotice>
            ) : (
              <InlineNotice tone="default">
                {isVideo
                  ? draft.mode === 'standard'
                    ? 'Video credits are used only for AI video renders. Standard renders use more credits than Lite because they use the higher-quality Veo lane.'
                    : 'Video credits are used only for AI video renders. Lite is the lower-cost draft lane for faster iteration.'
                  : 'Image generation uses execution credits and respects the same server-side rate limits and billing controls as chat.'}
              </InlineNotice>
            )}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {confirmStage ? (
                <Button tone="ghost" type="button" onClick={() => setConfirmStage(false)} disabled={isSubmitting}>
                  Back to brief
                </Button>
              ) : (
                <Button tone="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
              )}
              <Button tone="accent" type="submit" disabled={submitDisabled}>
                {isSubmitting
                  ? 'Preparing...'
                  : isVideo
                    ? confirmNeeded && !confirmStage
                      ? `Review ${estimatedCredits} credit ${estimatedCredits === 1 ? 'render' : 'renders'}`
                      : confirmStage
                        ? `Confirm and use ${estimatedCredits} credits`
                        : 'Generate video'
                    : 'Generate image'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

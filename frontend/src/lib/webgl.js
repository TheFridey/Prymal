export function isWebGLAvailable() {
  if (typeof document === 'undefined' || import.meta.env?.MODE === 'test') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    const context =
      canvas.getContext('webgl2')
      || canvas.getContext('webgl')
      || canvas.getContext('experimental-webgl');

    if (!context) {
      return false;
    }

    const loseContext = context.getExtension('WEBGL_lose_context');
    loseContext?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function shouldPreferStaticHeroScene(options = {}) {
  if (typeof window === 'undefined') {
    return true;
  }

  const reducedMotion = options.reducedMotion
    ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) {
    return true;
  }

  if (window.matchMedia('(max-width: 768px)').matches) {
    return true;
  }

  if (
    window.matchMedia('(pointer: coarse)').matches
    && window.matchMedia('(max-width: 1024px)').matches
  ) {
    return true;
  }

  return !isWebGLAvailable();
}

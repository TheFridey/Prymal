export function isInternalDiagnosticsVisible(viewer) {
  return Boolean(viewer?.staff?.isStaff);
}

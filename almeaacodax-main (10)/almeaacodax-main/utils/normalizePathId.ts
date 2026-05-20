const LEGACY_PATH_ID_ALIASES: Record<string, string> = {
  qudrat: 'p_qudrat',
  tahsili: 'p_tahsili',
  step: 'p_step',
  nafes: 'p_nafes',
};

export const normalizePathId = (pathId?: string | null) => {
  if (!pathId) return '';
  return LEGACY_PATH_ID_ALIASES[pathId] || pathId;
};

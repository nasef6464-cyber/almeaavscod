export const shareTextSummary = async (title: string, text: string) => {
  if (!text.trim()) {
    return 'empty';
  }

  if ('share' in navigator && typeof navigator.share === 'function') {
    await navigator.share({ title, text });
    return 'shared';
  }

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  return 'opened';
};

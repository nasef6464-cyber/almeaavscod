export const sanitizeVideoUrl = (rawUrl?: string | null) => {
  if (!rawUrl) return '';

  let trimmedUrl = rawUrl.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmedUrl) return '';

  trimmedUrl = trimmedUrl
    .replace(/^https?:\/\/https?:\/\//i, 'https://')
    .replace(/^https?:\/\/:\/\//i, 'https://')
    .replace(/^:\/\//, 'https://')
    .replace(/^\/\//, 'https://');

  if (/^(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i.test(trimmedUrl)) {
    return `https://${trimmedUrl}`;
  }

  return trimmedUrl;
};

export const getYouTubeVideoId = (rawUrl?: string | null) => {
  const normalizedUrl = sanitizeVideoUrl(rawUrl);
  if (!normalizedUrl) return '';

  const safeUrl = /^https?:\/\//i.test(normalizedUrl) ? normalizedUrl : `https://${normalizedUrl}`;

  try {
    const parsedUrl = new URL(safeUrl);
    const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      return parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
    }

    if (host.includes('youtube.com')) {
      return (
        parsedUrl.searchParams.get('v') ||
        parsedUrl.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] ||
        ''
      );
    }
  } catch {
    return '';
  }

  return '';
};

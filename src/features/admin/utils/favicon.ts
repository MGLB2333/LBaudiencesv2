/**
 * Get favicon URL for a given website URL
 */
export function getFaviconUrl(url: string | null | undefined): string {
  if (!url) {
    return 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
  }

  try {
    // Ensure URL has a scheme
    let urlWithScheme = url.trim();
    if (!urlWithScheme.startsWith('http://') && !urlWithScheme.startsWith('https://')) {
      urlWithScheme = `https://${urlWithScheme}`;
    }

    const urlObj = new URL(urlWithScheme);
    const domain = urlObj.hostname;

    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch (error) {
    // If URL parsing fails, return placeholder
    return 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
  }
}

export function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;

  // YouTube: watch?v=, youtu.be/, embed/
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]{11})/
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;

  // Vimeo: vimeo.com/VIDEO_ID
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return null;
}

export function isVideoUrl(url: string): boolean {
  return getVideoEmbedUrl(url) !== null;
}

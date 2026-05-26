export type Platform = 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'bluesky' | 'discord' | 'threads';

export const ALL_PLATFORMS: Platform[] = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'bluesky', 'discord', 'threads'];

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: 'X (Twitter)',
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  bluesky: 'Bluesky',
  discord: 'Discord',
  threads: 'Threads',
};

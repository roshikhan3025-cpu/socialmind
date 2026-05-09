// ============================================================
// SocialMind — Agent Configuration Types
// ============================================================

export type Platform = 'twitter' | 'facebook' | 'instagram';

export type AgentStatus = 'active' | 'paused' | 'setup';

export type AIProvider = 'groq' | 'openrouter' | 'azure' | 'openai' | 'nvidia' | 'custom';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export type ToneStyle =
  | 'professional'
  | 'casual'
  | 'witty'
  | 'informative'
  | 'provocative'
  | 'friendly'
  | 'authoritative';

export type ContentMixType = 'original' | 'reply' | 'quote' | 'thread';

export interface AgentIdentity {
  name: string;
  avatar: string; // URL or base64
  bio: string;
  tagline: string;
}

export interface PersonalityConfig {
  tone: ToneStyle;
  writingStyle: string; // freeform description
  topics: string[]; // areas of expertise
  examplePosts: string[]; // sample posts for style reference
  systemPrompt: string; // generated from personality config
  doNotMention: string[]; // forbidden topics
  languages: string[]; // e.g., ['en']
}

export interface InspirationAccount {
  platform: Platform;
  handle: string;
  url: string;
  notes: string; // what to draw from this account
}

export interface PlatformConnection {
  connected: boolean;
  composioUserId?: string;
  connectedAccountId?: string;
  handle?: string;
  displayName?: string;
  connectedAt?: number;
}

export interface PlatformConnections {
  twitter: PlatformConnection;
  facebook: PlatformConnection;
  instagram: PlatformConnection;
}

export interface TimeSlot {
  hour: number; // 0-23
  minute: number; // 0-59
  enabled: boolean;
}

export interface PlatformSchedule {
  enabled: boolean;
  postsPerDay: number;
  timeSlots: TimeSlot[];
  contentMix: Record<ContentMixType, number>; // weights 0-100
}

export interface PostingSchedule {
  twitter: PlatformSchedule;
  facebook: PlatformSchedule;
  instagram: PlatformSchedule;
  timezone: string;
}

export interface ContentRules {
  hashtagStrategy: 'none' | 'minimal' | 'moderate' | 'aggressive';
  defaultHashtags: string[];
  mentionRules: string;
  brandGuidelines: string;
  forbiddenWords: string[];
  maxPostLength: Record<Platform, number>;
  includeEmojis: boolean;
  includeLinks: boolean;
}

export interface ImageLibraryItem {
  id: string;
  url: string; // public URL served via /api/images?id=xxx
  name: string;
  uploadedAt: number;
}

export interface AgentConfig {
  id: string;
  userId: string;
  identity: AgentIdentity;
  personality: PersonalityConfig;
  inspiration: InspirationAccount[];
  platforms: PlatformConnections;
  schedule: PostingSchedule;
  rules: ContentRules;
  imageLibrary: ImageLibraryItem[];
  aiSettings: AISettings;
  status: AgentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface PostLog {
  id: string;
  agentId: string;
  platform: Platform;
  content: string;
  postType: ContentMixType;
  postUrl?: string;
  externalPostId?: string;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  status: 'posted' | 'failed' | 'pending';
  error?: string;
  createdAt: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  createdAt: number;
}

// Default values for new agent setup
export const DEFAULT_PLATFORM_CONNECTION: PlatformConnection = {
  connected: false,
};

export const DEFAULT_PLATFORM_SCHEDULE: PlatformSchedule = {
  enabled: false,
  postsPerDay: 3,
  timeSlots: [
    { hour: 9, minute: 0, enabled: true },
    { hour: 13, minute: 0, enabled: true },
    { hour: 18, minute: 0, enabled: true },
  ],
  contentMix: {
    original: 60,
    reply: 20,
    quote: 15,
    thread: 5,
  },
};

export const DEFAULT_CONTENT_RULES: ContentRules = {
  hashtagStrategy: 'moderate',
  defaultHashtags: [],
  mentionRules: '',
  brandGuidelines: '',
  forbiddenWords: [],
  maxPostLength: {
    twitter: 280,
    facebook: 2000,
    instagram: 2200,
  },
  includeEmojis: true,
  includeLinks: true,
};

export const DEFAULT_AGENT_CONFIG: Omit<AgentConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  identity: {
    name: '',
    avatar: '',
    bio: '',
    tagline: '',
  },
  personality: {
    tone: 'professional',
    writingStyle: '',
    topics: [],
    examplePosts: [],
    systemPrompt: '',
    doNotMention: [],
    languages: ['en'],
  },
  inspiration: [],
  platforms: {
    twitter: { ...DEFAULT_PLATFORM_CONNECTION },
    facebook: { ...DEFAULT_PLATFORM_CONNECTION },
    instagram: { ...DEFAULT_PLATFORM_CONNECTION },
  },
  schedule: {
    twitter: { ...DEFAULT_PLATFORM_SCHEDULE },
    facebook: { ...DEFAULT_PLATFORM_SCHEDULE },
    instagram: { ...DEFAULT_PLATFORM_SCHEDULE },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  rules: { ...DEFAULT_CONTENT_RULES },
  imageLibrary: [],
  aiSettings: {
    provider: 'openrouter',
    apiKey: '',
    model: 'anthropic/claude-3-sonnet',
  },
  status: 'setup',
};

// Wizard step definitions
export const WIZARD_STEPS = [
  { id: 'identity', title: 'Agent Identity', description: 'Name and personality basics' },
  { id: 'personality', title: 'Voice & Style', description: 'How your agent communicates' },
  { id: 'inspiration', title: 'Inspiration', description: 'Accounts to draw style from' },
  { id: 'platforms', title: 'Connect Platforms', description: 'Link your social accounts' },
  { id: 'schedule', title: 'Posting Schedule', description: 'When and how often to post' },
  { id: 'images', title: 'Image Library', description: 'Upload images for Instagram posts' },
  { id: 'rules', title: 'Content Rules', description: 'Guidelines and boundaries' },
  { id: 'review', title: 'Review & Launch', description: 'Confirm and activate' },
] as const;

export type WizardStepId = typeof WIZARD_STEPS[number]['id'];

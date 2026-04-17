// ============================================================
// SocialMind — AI Content Generator
// Uses agent personality config to generate platform-specific posts
// Supports: 4everland, Groq, Google Gemini
// ============================================================

import type { AgentConfig, Platform, ContentMixType } from '../src/types/agent.js';

type AIProvider = '4everland' | 'groq' | 'gemini';

interface GeneratedContent {
  text: string;
  platform: Platform;
  type: ContentMixType;
  hashtags: string[];
  provider?: AIProvider;
}

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
}

function buildSystemPrompt(agent: AgentConfig): string {
  const { identity, personality, rules } = agent;

  return `You are "${identity.name}" — an autonomous social media AI agent.

PERSONALITY:
- Bio: ${identity.bio}
- Tagline: ${identity.tagline}
- Tone: ${personality.tone}
- Writing Style: ${personality.writingStyle}
- Topics of Expertise: ${personality.topics.join(', ')}
- Languages: ${personality.languages.join(', ')}

${personality.examplePosts.length > 0 ? `EXAMPLE POSTS (match this style):
${personality.examplePosts.map((p, i) => `${i + 1}. "${p}"`).join('\n')}` : ''}

CONTENT RULES:
- Hashtag Strategy: ${rules.hashtagStrategy}
${rules.defaultHashtags.length > 0 ? `- Default Hashtags: ${rules.defaultHashtags.join(', ')}` : ''}
- Include Emojis: ${rules.includeEmojis ? 'Yes' : 'No'}
- Include Links: ${rules.includeLinks ? 'Yes' : 'No'}
${rules.brandGuidelines ? `- Brand Guidelines: ${rules.brandGuidelines}` : ''}

FORBIDDEN TOPICS/WORDS:
${[...personality.doNotMention, ...rules.forbiddenWords].join(', ') || 'None specified'}

${personality.systemPrompt ? `ADDITIONAL INSTRUCTIONS:\n${personality.systemPrompt}` : ''}

You must stay in character at all times. Generate content that is authentic, engaging, and matches the personality described above.`;
}

function buildContentPrompt(
  platform: Platform,
  contentType: ContentMixType,
  maxLength: number,
  agent: AgentConfig,
): string {
  const platformNames: Record<Platform, string> = {
    twitter: 'X (Twitter)',
    facebook: 'Facebook',
    instagram: 'Instagram',
  };

  const typeInstructions: Record<ContentMixType, string> = {
    original: 'Write an original post. Be insightful, engaging, and share a valuable thought or observation.',
    reply: 'Write a thoughtful reply/comment that adds value to a conversation. Make it conversational and engaging.',
    quote: 'Write a quote-tweet style post that references an interesting topic with your own take.',
    thread: 'Write the first post of a thread (keep it as a hook/opener that makes people want to read more).',
  };

  const topics = agent.personality.topics;
  const randomTopic = topics.length > 0
    ? topics[Math.floor(Math.random() * topics.length)]
    : 'something relevant to your expertise';

  return `Generate a ${contentType} post for ${platformNames[platform]}.

Topic direction: ${randomTopic}

${typeInstructions[contentType]}

REQUIREMENTS:
- Maximum ${maxLength} characters
- Platform: ${platformNames[platform]}
- Type: ${contentType}
${agent.rules.hashtagStrategy !== 'none' ? `- Include ${agent.rules.hashtagStrategy === 'minimal' ? '1-2' : agent.rules.hashtagStrategy === 'moderate' ? '3-5' : '5-10'} relevant hashtags` : '- No hashtags'}
${agent.rules.includeEmojis ? '- Include relevant emojis naturally' : '- No emojis'}

IMPORTANT: Return ONLY the post content. No quotes, no metadata, no explanation. Just the raw post text.`;
}

// Provider API endpoints
const PROVIDER_CONFIGS: Record<AIProvider, string> = {
  '4everland': 'https://ai.api.4everland.org/api/v1/chat/completions',
  'groq': 'https://api.groq.com/openai/v1/chat/completions',
  'gemini': 'https://generativelanguage.googleapis.com/v1beta/models/',
};

async function callAIProvider(
  provider: AIProvider,
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
): Promise<string> {
  if (provider === 'gemini') {
    // Google Gemini API format
    const endpoint = `${PROVIDER_CONFIGS[provider]}${model}:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages.map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    // OpenAI-compatible format (4everland, Groq)
    const response = await fetch(PROVIDER_CONFIGS[provider], {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.9,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${provider} API error: ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

export async function generateContent(
  agent: AgentConfig,
  platform: Platform,
  contentType: ContentMixType,
  provider: AIProvider = '4everland',
  apiKey?: string,
): Promise<GeneratedContent> {
  if (!apiKey) {
    throw new Error(`API key required for ${provider}`);
  }

  // Select appropriate model based on provider
  const modelMap: Record<AIProvider, string> = {
    '4everland': 'anthropic/claude-sonnet-4',
    'groq': 'mixtral-8x7b-32768',
    'gemini': 'gemini-2.0-flash',
  };

  const model = modelMap[provider];
  const maxLength = agent.rules.maxPostLength[platform];
  const systemPrompt = buildSystemPrompt(agent);
  const userPrompt = buildContentPrompt(platform, contentType, maxLength, agent);

  const text = await callAIProvider(
    provider,
    model,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    apiKey,
  );

  let trimmedText = text;
  if (trimmedText.length > maxLength) {
    trimmedText = trimmedText.slice(0, maxLength - 3) + '...';
  }

  // Extract hashtags
  const hashtagRegex = /#[\w]+/g;
  const hashtags = trimmedText.match(hashtagRegex) || [];

  return {
    text: trimmedText,
    platform,
    type: contentType,
    hashtags,
    provider,
  };
}

// Select a content type based on the agent's content mix weights
export function selectContentType(
  weights: Record<ContentMixType, number>,
): ContentMixType {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total === 0) return 'original';

  let random = Math.random() * total;
  for (const [type, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) return type as ContentMixType;
  }
  return 'original';
}

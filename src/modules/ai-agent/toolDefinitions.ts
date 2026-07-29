import type { AgentToolDefinition } from '@/types';

/**
 * Tool schema exposed to AI providers via function-calling. The agent only
 * ever proposes these; execution lives in campaign-manager / creative-studio /
 * audience-builder / website-analyzer.
 */
export const AGENT_TOOLS: AgentToolDefinition[] = [
  {
    name: 'analyze_website',
    description: "Analyze a landing page URL to inform campaign strategy.",
    parametersSchema: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },
  {
    name: 'create_campaigns',
    description:
      'Create one or more new Pinterest ad campaigns with an objective, budget, and audience.',
    parametersSchema: {
      type: 'object',
      properties: {
        campaigns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              objective: {
                type: 'string',
                enum: ['awareness', 'traffic', 'conversions', 'catalog_sales', 'video_views'],
              },
              websiteUrl: { type: 'string' },
              budgetAmount: { type: 'number' },
              budgetType: { type: 'string', enum: ['daily', 'lifetime'] },
              currency: { type: 'string' },
              gender: { type: 'string', enum: ['women', 'men', 'all'] },
              ageMin: { type: 'number' },
              ageMax: { type: 'number' },
              countryCode: { type: 'string' },
              countryName: { type: 'string' },
              headlines: { type: 'array', items: { type: 'string' } },
              descriptions: { type: 'array', items: { type: 'string' } },
            },
            required: ['name', 'objective', 'budgetAmount'],
          },
        },
      },
      required: ['campaigns'],
    },
  },
  {
    name: 'update_campaign',
    description: 'Update fields on an existing campaign (name, objective, status).',
    parametersSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string' },
        name: { type: 'string' },
        objective: { type: 'string' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'duplicate_campaign',
    description: 'Duplicate an existing campaign, optionally overriding country/name.',
    parametersSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string' },
        newName: { type: 'string' },
        countryCode: { type: 'string' },
        countryName: { type: 'string' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'update_audience',
    description: 'Update the target audience for one or all ad groups of a campaign.',
    parametersSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string' },
        gender: { type: 'string', enum: ['women', 'men', 'all'] },
        ageMin: { type: 'number' },
        ageMax: { type: 'number' },
        countryCode: { type: 'string' },
        countryName: { type: 'string' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'update_budget',
    description: 'Update the budget for one campaign, or all campaigns if campaignId is omitted.',
    parametersSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string' },
        amount: { type: 'number' },
        type: { type: 'string', enum: ['daily', 'lifetime'] },
      },
      required: ['amount'],
    },
  },
  {
    name: 'generate_headlines',
    description: 'Generate new headline variants for a campaign in a given tone.',
    parametersSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string' },
        tone: {
          type: 'string',
          enum: ['neutral', 'emotional', 'premium', 'playful', 'urgent', 'seasonal'],
        },
        count: { type: 'number' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'generate_descriptions',
    description: 'Generate new description variants for a campaign in a given tone.',
    parametersSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string' },
        tone: { type: 'string' },
        count: { type: 'number' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'regenerate_creative',
    description: 'Regenerate both headlines and descriptions for a campaign, e.g. for a seasonal or holiday version.',
    parametersSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string' },
        theme: { type: 'string' },
        tone: { type: 'string' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'pause_campaign',
    description: 'Pause a campaign.',
    parametersSchema: {
      type: 'object',
      properties: { campaignId: { type: 'string' } },
      required: ['campaignId'],
    },
  },
  {
    name: 'resume_campaign',
    description: 'Resume a paused campaign.',
    parametersSchema: {
      type: 'object',
      properties: { campaignId: { type: 'string' } },
      required: ['campaignId'],
    },
  },
  {
    name: 'compute_ai_score',
    description: 'Recompute the AI Score for a campaign.',
    parametersSchema: {
      type: 'object',
      properties: { campaignId: { type: 'string' } },
      required: ['campaignId'],
    },
  },
];

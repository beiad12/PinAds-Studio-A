/**
 * Thin typed client over the Pinterest Ads API v5 (https://developers.pinterest.com/docs/api/v5/).
 * Every function here makes a real network call — nothing in this file is a simulation.
 */

const API_BASE = 'https://api.pinterest.com/v5';

async function pinterestFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pinterest API ${path} failed (${response.status}): ${body}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface PinterestAdAccountDto {
  id: string;
  name: string;
}

export async function listAdAccounts(accessToken: string): Promise<PinterestAdAccountDto[]> {
  const data = await pinterestFetch<{ items: PinterestAdAccountDto[] }>(
    accessToken,
    '/ad_accounts'
  );
  return data.items ?? [];
}

export interface PinterestBoardDto {
  id: string;
  name: string;
}

export async function listBoards(accessToken: string): Promise<PinterestBoardDto[]> {
  const data = await pinterestFetch<{ items: PinterestBoardDto[] }>(accessToken, '/boards');
  return data.items ?? [];
}

export async function createBoard(accessToken: string, name: string): Promise<PinterestBoardDto> {
  return pinterestFetch<PinterestBoardDto>(accessToken, '/boards', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export interface CreatePinInput {
  boardId: string;
  imageUrl: string;
  title: string;
  description?: string;
  link?: string;
}

export async function createPin(
  accessToken: string,
  input: CreatePinInput
): Promise<{ id: string }> {
  return pinterestFetch<{ id: string }>(accessToken, '/pins', {
    method: 'POST',
    body: JSON.stringify({
      board_id: input.boardId,
      title: input.title,
      description: input.description,
      link: input.link,
      media_source: {
        source_type: 'image_url',
        url: input.imageUrl,
      },
    }),
  });
}

const OBJECTIVE_MAP: Record<string, string> = {
  awareness: 'AWARENESS',
  traffic: 'WEB_SESSIONS',
  conversions: 'WEB_CONVERSION',
  catalog_sales: 'CATALOG_SALES',
  video_views: 'VIDEO_VIEW',
};

export interface CreateCampaignInput {
  adAccountId: string;
  name: string;
  objective: string;
  dailyBudgetMicroCurrency?: number;
  lifetimeBudgetMicroCurrency?: number;
}

export async function createCampaign(
  accessToken: string,
  input: CreateCampaignInput
): Promise<{ id: string }> {
  return pinterestFetch<{ id: string }>(
    accessToken,
    `/ad_accounts/${input.adAccountId}/campaigns`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        objective_type: OBJECTIVE_MAP[input.objective] ?? 'AWARENESS',
        status: 'ACTIVE',
        daily_spend_cap: input.dailyBudgetMicroCurrency,
        lifetime_spend_cap: input.lifetimeBudgetMicroCurrency,
      }),
    }
  );
}

function ageBucket(min: number, max: number): string[] {
  const buckets = ['18-24', '25-34', '35-44', '45-49', '50-54', '55-64', '65+'];
  const ranges: [number, number][] = [
    [18, 24],
    [25, 34],
    [35, 44],
    [45, 49],
    [50, 54],
    [55, 64],
    [65, 200],
  ];
  return buckets.filter((_, i) => ranges[i][0] <= max && ranges[i][1] >= min);
}

export interface CreateAdGroupInput {
  adAccountId: string;
  campaignId: string;
  name: string;
  dailyBudgetMicroCurrency?: number;
  gender: 'women' | 'men' | 'all';
  ageMin: number;
  ageMax: number;
  countryCodes: string[];
}

export async function createAdGroup(
  accessToken: string,
  input: CreateAdGroupInput
): Promise<{ id: string }> {
  const targetingSpec: Record<string, string[]> = {
    LOCATION: input.countryCodes,
    AGE_BUCKET: ageBucket(input.ageMin, input.ageMax),
  };
  if (input.gender !== 'all') {
    targetingSpec.GENDER = [input.gender === 'women' ? 'female' : 'male'];
  }

  return pinterestFetch<{ id: string }>(
    accessToken,
    `/ad_accounts/${input.adAccountId}/ad_groups`,
    {
      method: 'POST',
      body: JSON.stringify({
        campaign_id: input.campaignId,
        name: input.name,
        status: 'ACTIVE',
        billable_event: 'IMPRESSION',
        budget_in_micro_currency: input.dailyBudgetMicroCurrency,
        targeting_spec: targetingSpec,
      }),
    }
  );
}

export interface CreateAdInput {
  adAccountId: string;
  adGroupId: string;
  pinId: string;
  name: string;
}

export async function createAd(
  accessToken: string,
  input: CreateAdInput
): Promise<{ id: string }> {
  return pinterestFetch<{ id: string }>(accessToken, `/ad_accounts/${input.adAccountId}/ads`, {
    method: 'POST',
    body: JSON.stringify({
      ad_group_id: input.adGroupId,
      pin_id: input.pinId,
      name: input.name,
      creative_type: 'REGULAR',
      status: 'ACTIVE',
    }),
  });
}

export async function updateCampaignStatus(
  accessToken: string,
  adAccountId: string,
  campaignId: string,
  status: 'ACTIVE' | 'PAUSED'
): Promise<void> {
  await pinterestFetch(accessToken, `/ad_accounts/${adAccountId}/campaigns/${campaignId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

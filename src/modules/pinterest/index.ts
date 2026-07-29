/**
 * pinterest: OAuth connection lifecycle + real Pinterest Ads API v5 publishing.
 * This is the only module allowed to call api.pinterest.com or pinterest.com/oauth.
 * `campaign-manager` calls `publishCampaign` and persists the result — this module
 * never touches storage directly except for the connection/app credentials in Settings.
 */

import { getSettings, saveSettings } from '../settings';
import * as oauth from './oauth';
import * as client from './client';
import { nowISO } from '@/lib/id';
import type { Campaign, PinterestAdAccount, PinterestBoard, PinterestConnection } from '@/types';

export async function getConnection(): Promise<PinterestConnection | undefined> {
  const settings = await getSettings();
  return settings.pinterestConnection;
}

export async function isConnected(): Promise<boolean> {
  return Boolean(await getConnection());
}

/** Runs the full OAuth consent flow and stores the resulting tokens. */
export async function connect(): Promise<PinterestConnection> {
  const settings = await getSettings();
  if (!settings.pinterestApp?.clientId || !settings.pinterestApp?.clientSecret) {
    throw new Error(
      'Add your Pinterest app Client ID and Client Secret in Settings before connecting.'
    );
  }
  const connection = await oauth.authorize(settings.pinterestApp);
  await saveSettings({ pinterestConnection: connection });
  return connection;
}

export async function disconnect(): Promise<void> {
  await saveSettings({ pinterestConnection: undefined });
}

async function ensureFreshConnection(): Promise<PinterestConnection> {
  const settings = await getSettings();
  const connection = settings.pinterestConnection;
  if (!connection) {
    throw new Error('Pinterest is not connected. Connect your account in Settings first.');
  }
  if (!settings.pinterestApp) {
    throw new Error('Pinterest app credentials are missing from Settings.');
  }
  if (!oauth.isExpiringSoon(connection)) return connection;

  const refreshed = await oauth.refreshConnection(settings.pinterestApp, connection);
  await saveSettings({ pinterestConnection: refreshed });
  return refreshed;
}

export async function fetchAdAccounts(): Promise<PinterestAdAccount[]> {
  const connection = await ensureFreshConnection();
  return client.listAdAccounts(connection.accessToken);
}

export async function selectAdAccount(id: string, name: string): Promise<void> {
  const connection = await ensureFreshConnection();
  await saveSettings({ pinterestConnection: { ...connection, adAccountId: id, adAccountName: name } });
}

export async function fetchBoards(): Promise<PinterestBoard[]> {
  const connection = await ensureFreshConnection();
  return client.listBoards(connection.accessToken);
}

export async function createBoard(name: string): Promise<PinterestBoard> {
  const connection = await ensureFreshConnection();
  return client.createBoard(connection.accessToken, name);
}

export async function selectBoard(id: string, name: string): Promise<void> {
  const connection = await ensureFreshConnection();
  await saveSettings({ pinterestConnection: { ...connection, boardId: id, boardName: name } });
}

/**
 * Publishes a campaign to Pinterest for real: creates the Campaign, then for
 * each ad group creates a Pin (from its selected creative + an image URL the
 * user supplied in the Pins tab) and an Ad pointing at that Pin. Returns the
 * campaign mutated with the resulting Pinterest object ids — the caller
 * (`campaign-manager`) is responsible for persisting it.
 */
export async function publishCampaign(campaign: Campaign): Promise<Campaign> {
  const connection = await ensureFreshConnection();
  if (!connection.adAccountId) {
    throw new Error('Select a Pinterest ad account in Settings before publishing.');
  }
  if (!connection.boardId) {
    throw new Error('Select or create a Pinterest board in Settings before publishing.');
  }
  for (const group of campaign.adGroups) {
    if (!group.creative.pins.some((p) => p.imageUrl)) {
      throw new Error(
        `Ad group "${group.name}" has no Pin image yet — add an image URL in the Pins tab before publishing.`
      );
    }
  }

  const dailyBudgetMicro =
    campaign.budget.type === 'daily' ? Math.round(campaign.budget.amount * 1_000_000) : undefined;
  const lifetimeBudgetMicro =
    campaign.budget.type === 'lifetime' ? Math.round(campaign.budget.amount * 1_000_000) : undefined;

  const pinterestCampaign = await client.createCampaign(connection.accessToken, {
    adAccountId: connection.adAccountId,
    name: campaign.name,
    objective: campaign.objective,
    dailyBudgetMicroCurrency: dailyBudgetMicro,
    lifetimeBudgetMicroCurrency: lifetimeBudgetMicro,
  });

  const updatedAdGroups = [];
  for (const group of campaign.adGroups) {
    const pin = group.creative.pins.find((p) => p.imageUrl)!;
    const headline = group.creative.headlines.find((h) => h.isSelected)?.text ?? pin.title;
    const description = group.creative.descriptions.find((d) => d.isSelected)?.text;

    const pinterestPin = await client.createPin(connection.accessToken, {
      boardId: connection.boardId,
      imageUrl: pin.imageUrl!,
      title: headline,
      description,
      link: pin.destinationUrl || campaign.websiteUrl,
    });

    const pinterestAdGroup = await client.createAdGroup(connection.accessToken, {
      adAccountId: connection.adAccountId,
      campaignId: pinterestCampaign.id,
      name: group.name,
      dailyBudgetMicroCurrency: dailyBudgetMicro,
      gender: group.audience.gender,
      ageMin: group.audience.ageRange.min,
      ageMax: group.audience.ageRange.max,
      countryCodes: group.audience.locations.map((l) => l.countryCode),
    });

    const pinterestAd = await client.createAd(connection.accessToken, {
      adAccountId: connection.adAccountId,
      adGroupId: pinterestAdGroup.id,
      pinId: pinterestPin.id,
      name: `${group.name} — Ad`,
    });

    updatedAdGroups.push({
      ...group,
      pinterestAdGroupId: pinterestAdGroup.id,
      pinterestPinId: pinterestPin.id,
      pinterestAdId: pinterestAd.id,
    });
  }

  return {
    ...campaign,
    adGroups: updatedAdGroups,
    status: 'active',
    pinterestCampaignId: pinterestCampaign.id,
    pinterestAdAccountId: connection.adAccountId,
    publishedAt: nowISO(),
    publishError: undefined,
  };
}

/** Pauses/resumes the live Pinterest campaign to match a local status change. */
export async function syncCampaignStatus(campaign: Campaign): Promise<void> {
  if (!campaign.pinterestCampaignId || !campaign.pinterestAdAccountId) return;
  const connection = await ensureFreshConnection();
  await client.updateCampaignStatus(
    connection.accessToken,
    campaign.pinterestAdAccountId,
    campaign.pinterestCampaignId,
    campaign.status === 'paused' ? 'PAUSED' : 'ACTIVE'
  );
}

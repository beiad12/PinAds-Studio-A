/**
 * Pinterest account connection + publish-result models.
 * Owned by the `pinterest` module (OAuth + Ads API v5 client).
 */

export interface PinterestConnection {
  accessToken: string;
  refreshToken?: string;
  /** ISO timestamp; access tokens are refreshed proactively before this. */
  expiresAt?: string;
  adAccountId?: string;
  adAccountName?: string;
  boardId?: string;
  boardName?: string;
  connectedAt: string; // ISO timestamp
}

export interface PinterestAppCredentials {
  clientId: string;
  /**
   * Required by Pinterest's authorization-code token exchange. Stored locally
   * via chrome.storage only — never sent anywhere but api.pinterest.com.
   * This extension is for personal/local use; do not publish it to the
   * Chrome Web Store with a secret embedded.
   */
  clientSecret: string;
}

export interface PinterestAdAccount {
  id: string;
  name: string;
}

export interface PinterestBoard {
  id: string;
  name: string;
}

/** IDs of the objects actually created on Pinterest for one ad group's Pin + ad. */
export interface PinterestPublishRefs {
  pinId?: string;
  adId?: string;
}

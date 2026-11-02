type Row = Record<string, any>;

export type MembershipPlan = 'free' | 'premium' | 'high_premium';

export function effectivePlan(user: Row, at = Date.now()): MembershipPlan {
  const tier = user.subscription_tier;
  if (tier !== 'premium' && tier !== 'high_premium') return 'free';
  if (user.subscription_source === 'admin' && !user.subscription_expires_at) return tier;
  const expiresAt = Date.parse(String(user.subscription_expires_at || ''));
  return Number.isFinite(expiresAt) && expiresAt > at ? tier : 'free';
}

export function utcDayStart(at = Date.now()): string {
  return new Date(at).toISOString().slice(0, 10) + 'T00:00:00.000Z';
}

export function utcDayKey(at = Date.now()): string {
  return new Date(at).toISOString().slice(0, 10);
}

function base64Url(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function playAccessToken(serviceAccountJson: string): Promise<string> {
  const account = JSON.parse(serviceAccountJson) as { client_email?: string; private_key?: string };
  if (!account.client_email || !account.private_key) throw new Error('Billing credentials are incomplete.');
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const pem = account.private_key.replace(/\\n/g, '\n').replace(/-----[^-]+-----|\s/g, '');
  const keyData = atob(pem);
  const keyBytes = Uint8Array.from(keyData, (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', keyBytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${base64Url(new Uint8Array(signature))}` }),
  });
  if (!response.ok) throw new Error('Could not authenticate with Google Play.');
  const result = await response.json() as { access_token?: string };
  if (!result.access_token) throw new Error('Google Play did not return an access token.');
  return result.access_token;
}

export type PlayVerification =
  | { ok: true; plan: Exclude<MembershipPlan, 'free'>; productId: string; basePlanId: string; expiresAt: string }
  | { ok: false; status: number; error: string };

export async function verifyGooglePlaySubscription(
  env: Record<string, any>,
  purchaseToken: string,
  expectedAccountId: string,
): Promise<PlayVerification> {
  const credentials = String(env.PLAY_SERVICE_ACCOUNT_JSON || '');
  if (!credentials) return { ok: false, status: 503, error: 'Google Play billing is not configured yet.' };

  const packageName = String(env.ANDROID_PACKAGE_NAME || 'com.fatwa.mobile');
  const expectedProduct = String(env.PLAY_MEMBERSHIP_PRODUCT_ID || 'fatwa_membership');
  const premiumBasePlan = String(env.PLAY_PREMIUM_BASE_PLAN_ID || 'premium-monthly');
  const highBasePlan = String(env.PLAY_HIGH_PREMIUM_BASE_PLAN_ID || 'high-premium-monthly');

  try {
    const accessToken = await playAccessToken(credentials);
    const endpoint = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
    const response = await fetch(endpoint, { headers: { authorization: `Bearer ${accessToken}` } });
    if (response.status === 404) return { ok: false, status: 400, error: 'Google Play could not verify this purchase.' };
    if (!response.ok) return { ok: false, status: 502, error: 'Google Play purchase verification failed. Please try again.' };

    const purchase = await response.json() as Row;
    const accountId = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId;
    if (accountId !== expectedAccountId) return { ok: false, status: 409, error: 'This purchase is linked to a different app account.' };

    const activeStates = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED']);
    if (!activeStates.has(String(purchase.subscriptionState || ''))) return { ok: false, status: 409, error: 'This Google Play subscription is not active.' };

    const line = (purchase.lineItems || []).find((item: Row) => item.productId === expectedProduct);
    const basePlanId = String(line?.offerDetails?.basePlanId || '');
    const plan = basePlanId === highBasePlan ? 'high_premium' : basePlanId === premiumBasePlan ? 'premium' : null;
    const expiresAt = Date.parse(String(line?.expiryTime || ''));
    if (!line || !plan || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return { ok: false, status: 409, error: 'No active Fatwa membership was found for this purchase.' };
    }

    if (purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
      const ack = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(expectedProduct)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: '{}',
      });
      if (!ack.ok) return { ok: false, status: 502, error: 'Google Play could not finalize the purchase. Please retry.' };
    }

    return { ok: true, plan, productId: expectedProduct, basePlanId, expiresAt: new Date(expiresAt).toISOString() };
  } catch (error) {
    console.error('play verification', error instanceof Error ? error.message : 'unknown error');
    return { ok: false, status: 503, error: 'Google Play verification is temporarily unavailable.' };
  }
}

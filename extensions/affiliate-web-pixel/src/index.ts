import {register} from "@shopify/web-pixels-extension";

const ATTRIBUTION_STORAGE_KEY = "converxity:affiliate-attribution";
const ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type StoredAttribution = {
  affiliateCode: string;
  capturedAt: string;
  expiresAt: string;
  landingUrl: string;
};

type PixelBrowser = {
  localStorage: {
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
    setItem(key: string, value: string): Promise<void>;
  };
};

function normalizeAffiliateCode(value: string | null) {
  const normalized = value?.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  if (normalized.length < 2 || normalized.length > 64) {
    return null;
  }

  if (!/^[A-Z0-9_-]+$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function isStoredAttribution(value: unknown): value is StoredAttribution {
  if (!value || typeof value !== "object") {
    return false;
  }

  const attribution = value as Partial<StoredAttribution>;

  return (
    typeof attribution.affiliateCode === "string" &&
    typeof attribution.capturedAt === "string" &&
    typeof attribution.expiresAt === "string" &&
    typeof attribution.landingUrl === "string"
  );
}

function isExpired(expiresAt: string) {
  return Date.parse(expiresAt) <= Date.now();
}

async function readStoredAttribution(
  browser: PixelBrowser,
) {
  const rawValue = await browser.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!isStoredAttribution(parsed)) {
      await browser.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
      return null;
    }

    if (isExpired(parsed.expiresAt)) {
      await browser.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
      console.log("[affiliate-web-pixel] Expired attribution removed", parsed);
      return null;
    }

    return parsed;
  } catch {
    await browser.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
    return null;
  }
}

async function persistAttribution(
  browser: PixelBrowser,
  attribution: StoredAttribution,
) {
  await browser.localStorage.setItem(
    ATTRIBUTION_STORAGE_KEY,
    JSON.stringify(attribution),
  );
}

register(({analytics, browser, init, settings}) => {
  analytics.subscribe("page_viewed", async (event) => {
    const pageUrl = event.context.document.location.href;
    const ref = new URL(pageUrl).searchParams.get("ref");
    const affiliateCode = normalizeAffiliateCode(ref);

    if (!affiliateCode) {
      await readStoredAttribution(browser);
      return;
    }

    const capturedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ATTRIBUTION_WINDOW_MS).toISOString();

    const attribution: StoredAttribution = {
      affiliateCode,
      capturedAt,
      expiresAt,
      landingUrl: pageUrl,
    };

    await persistAttribution(browser, attribution);

    const persistedValue = await readStoredAttribution(browser);

    console.log("[affiliate-web-pixel] Affiliate ref detected", {
      affiliateCode,
      pageUrl,
    });
    console.log(
      "[affiliate-web-pixel] Affiliate attribution persisted",
      persistedValue,
    );
  });

  analytics.subscribe("checkout_completed", async (event) => {
    const attribution = await readStoredAttribution(browser);

    if (!attribution) {
      console.log(
        "[affiliate-web-pixel] No valid affiliate attribution available for checkout_completed",
        {
          checkoutId: event.data.checkout.token,
          eventId: event.id,
        },
      );
      return;
    }

    const payload = {
      affiliateCode: attribution.affiliateCode,
      currencyCode:
        event.data.checkout.currencyCode ?? init.data.shop.paymentSettings.currencyCode,
      customerId: event.data.checkout.order?.customer?.id ?? null,
      happenedAt: event.timestamp,
      orderId: event.data.checkout.order?.id ?? event.data.checkout.token ?? event.id,
      orderName: null,
      shopDomain: init.data.shop.myshopifyDomain,
      sourceUrl: attribution.landingUrl,
      subtotalAmount: Number(event.data.checkout.subtotalPrice?.amount ?? 0),
    };

    console.log(
      "[affiliate-web-pixel] Affiliate attribution loaded for conversion",
      attribution,
    );
    console.log("[affiliate-web-pixel] Conversion payload ready", payload);

    if (typeof settings.conversionApiUrl !== "string" || !settings.conversionApiUrl) {
      console.log(
        "[affiliate-web-pixel] No conversionApiUrl configured; skipping backend report",
      );
      return;
    }

    try {
      const response = await fetch(settings.conversionApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Shop-Domain": init.data.shop.myshopifyDomain,
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });

      console.log("[affiliate-web-pixel] Conversion report response", {
        ok: response.ok,
        status: response.status,
      });
    } catch (error) {
      console.log("[affiliate-web-pixel] Conversion report failed", error);
    }
  });
});

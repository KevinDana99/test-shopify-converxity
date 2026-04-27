const SHOP_DOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function normalizeShopDomain(value: string) {
  return value.trim().toLowerCase();
}

export function isShopDomain(value: string) {
  return SHOP_DOMAIN_REGEX.test(normalizeShopDomain(value));
}

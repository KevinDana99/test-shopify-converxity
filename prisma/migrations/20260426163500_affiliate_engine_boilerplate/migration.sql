-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "commissionRateBps" INTEGER NOT NULL DEFAULT 1000,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Conversion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT,
    "affiliateId" TEXT,
    "affiliateCode" TEXT NOT NULL,
    "eventName" TEXT NOT NULL DEFAULT 'checkout_completed',
    "currencyCode" TEXT NOT NULL,
    "subtotalAmountCents" INTEGER NOT NULL,
    "commissionAmountCents" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "happenedAt" DATETIME NOT NULL,
    "sourceUrl" TEXT,
    "customerId" TEXT,
    "rawPayload" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversion_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'COMMISSION_CREATED',
    "amountCents" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BillingEvent_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "Conversion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppInstallationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "defaultCommissionRateBps" INTEGER NOT NULL DEFAULT 1000,
    "allowedOrigins" TEXT NOT NULL DEFAULT '*',
    "requireKnownAffiliate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_shop_code_key" ON "Affiliate"("shop", "code");

-- CreateIndex
CREATE INDEX "Affiliate_shop_status_idx" ON "Affiliate"("shop", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Conversion_shop_orderId_key" ON "Conversion"("shop", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversion_shop_idempotencyKey_key" ON "Conversion"("shop", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Conversion_shop_affiliateCode_idx" ON "Conversion"("shop", "affiliateCode");

-- CreateIndex
CREATE INDEX "Conversion_shop_createdAt_idx" ON "Conversion"("shop", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_conversionId_key" ON "BillingEvent"("conversionId");

-- CreateIndex
CREATE INDEX "BillingEvent_shop_status_idx" ON "BillingEvent"("shop", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AppInstallationSettings_shop_key" ON "AppInstallationSettings"("shop");

CREATE TABLE IF NOT EXISTS "ProductSale" (
  "id" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(10, 2) NOT NULL,
  "totalPrice" DECIMAL(10, 2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductSale_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ProductSale_inventoryItemId_fkey'
      AND table_name = 'ProductSale'
  ) THEN
    ALTER TABLE "ProductSale"
      ADD CONSTRAINT "ProductSale_inventoryItemId_fkey"
      FOREIGN KEY ("inventoryItemId")
      REFERENCES "InventoryItem"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ProductSale_createdAt_idx" ON "ProductSale"("createdAt");
CREATE INDEX IF NOT EXISTS "ProductSale_inventoryItemId_idx" ON "ProductSale"("inventoryItemId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "Client"
    WHERE "isActive" = true
    GROUP BY "phone"
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "Client_active_phone_unique"
      ON "Client"("phone")
      WHERE "isActive" = true;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "Client"
    WHERE "isActive" = true AND "email" IS NOT NULL
    GROUP BY LOWER("email")
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "Client_active_email_unique"
      ON "Client"(LOWER("email"))
      WHERE "isActive" = true AND "email" IS NOT NULL;
  END IF;
END $$;

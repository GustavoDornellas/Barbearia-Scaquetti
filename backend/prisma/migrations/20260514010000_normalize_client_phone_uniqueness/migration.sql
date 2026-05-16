DROP INDEX IF EXISTS "Client_active_phone_unique";

UPDATE "Client"
SET "phone" = regexp_replace("phone", '\D', '', 'g')
WHERE "phone" <> regexp_replace("phone", '\D', '', 'g');

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
END $$;

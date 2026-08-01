-- Receipt numbers are generated per school (RCP-<year>-00001 restarts for every
-- tenant), so a globally unique index made the second school's first payment
-- collide with the first school's. Scope the constraint to the tenant.
DROP INDEX IF EXISTS "fee_payments_receiptNumber_key";

CREATE UNIQUE INDEX "fee_payments_tenantId_receiptNumber_key"
  ON "fee_payments"("tenantId", "receiptNumber");

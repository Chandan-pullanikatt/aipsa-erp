-- Ledger of fee-due reminders that were actually dispatched. The unique index on
-- (tenant, student, structure, sentOn) makes the daily reminder job idempotent —
-- re-running it on the same day is a no-op — and `sentOn` is what the weekly
-- overdue cadence is measured against.
CREATE TABLE "fee_reminder_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "sentOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_reminder_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fee_reminder_logs_tenantId_studentId_feeStructureId_sentOn_key"
    ON "fee_reminder_logs"("tenantId", "studentId", "feeStructureId", "sentOn");

CREATE INDEX "fee_reminder_logs_tenantId_studentId_feeStructureId_idx"
    ON "fee_reminder_logs"("tenantId", "studentId", "feeStructureId");

ALTER TABLE "fee_reminder_logs" ADD CONSTRAINT "fee_reminder_logs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fee_reminder_logs" ADD CONSTRAINT "fee_reminder_logs_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fee_reminder_logs" ADD CONSTRAINT "fee_reminder_logs_feeStructureId_fkey"
    FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

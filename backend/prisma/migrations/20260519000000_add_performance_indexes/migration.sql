CREATE INDEX IF NOT EXISTS "Client_isActive_createdAt_idx" ON "Client"("isActive", "createdAt");
CREATE INDEX IF NOT EXISTS "Client_isActive_lastVisitAt_idx" ON "Client"("isActive", "lastVisitAt");

CREATE INDEX IF NOT EXISTS "Appointment_status_endTime_idx" ON "Appointment"("status", "endTime");
CREATE INDEX IF NOT EXISTS "Appointment_status_scheduledAt_idx" ON "Appointment"("status", "scheduledAt");

CREATE INDEX IF NOT EXISTS "QueueEntry_status_finishedAt_idx" ON "QueueEntry"("status", "finishedAt");
CREATE INDEX IF NOT EXISTS "QueueEntry_status_scheduledFor_idx" ON "QueueEntry"("status", "scheduledFor");

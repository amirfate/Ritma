-- Renames the AuditEventType enum value PUBLISHING to PUBLISH to match the
-- exact audit event name required by the specification. Postgres supports
-- renaming an enum label in place, so no data migration is needed (and
-- none existed yet — this schema had no application writing audit_logs
-- rows before this migration).
ALTER TYPE "audit_event_type" RENAME VALUE 'PUBLISHING' TO 'PUBLISH';

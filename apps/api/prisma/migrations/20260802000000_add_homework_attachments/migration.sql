-- Teachers post homework by photographing the worksheet/textbook page, and
-- students submit photos of their completed work, so both sides need more than
-- the one link `attachmentUrl` held. Stored as a JSONB array of
-- { url, key, name, type } rather than a child table: the list is small, always
-- read whole with its parent, and never queried on its own.
--
-- `attachmentUrl` stays and keeps mirroring the first entry, so existing rows
-- and any client that only reads the single link continue to work unchanged.
ALTER TABLE "homeworks" ADD COLUMN "attachments" JSONB;
ALTER TABLE "homework_submissions" ADD COLUMN "attachments" JSONB;

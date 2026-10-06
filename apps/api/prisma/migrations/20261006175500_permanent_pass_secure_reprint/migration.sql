-- Add encrypted storage for the active permanent-pass QR credential.
-- Existing passes remain valid; their historical plaintext token cannot be recovered from the existing hash.
ALTER TABLE "permanent_passes"
ADD COLUMN "qr_token_encrypted" TEXT;

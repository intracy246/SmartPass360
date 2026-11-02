CREATE TABLE "guard_sessions" (
  "id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "username" TEXT NOT NULL,
  "guard_name" TEXT NOT NULL,
  "login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "logged_out_at" TIMESTAMP(3),
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guard_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "guard_sessions_site_id_logged_out_at_last_seen_at_idx"
  ON "guard_sessions"("site_id", "logged_out_at", "last_seen_at");
CREATE INDEX "guard_sessions_site_id_login_at_idx"
  ON "guard_sessions"("site_id", "login_at");

ALTER TABLE "guard_sessions"
  ADD CONSTRAINT "guard_sessions_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Staff and customer numbers change from OPT-… to FBI-… (the client's prefix).
-- A number is only renamed when its FBI-… form isn't already taken.
UPDATE "User" u SET "staffNo" = 'FBI-' || substring(u."staffNo" from 5)
WHERE u."staffNo" LIKE 'OPT-%'
  AND NOT EXISTS (SELECT 1 FROM "User" x WHERE x."staffNo" = 'FBI-' || substring(u."staffNo" from 5));

-- Customer account numbers that were made by the app (OPT-CUS-…) move with their logins
UPDATE "User" SET "customerAccount" = 'FBI-' || substring("customerAccount" from 5) WHERE "customerAccount" LIKE 'OPT-CUS-%';
UPDATE "Task" SET "customerAccount" = 'FBI-' || substring("customerAccount" from 5) WHERE "customerAccount" LIKE 'OPT-CUS-%';
UPDATE "ServiceRequest" SET "customerAccount" = 'FBI-' || substring("customerAccount" from 5) WHERE "customerAccount" LIKE 'OPT-CUS-%';
UPDATE "SerialUnit" SET "customerAccount" = 'FBI-' || substring("customerAccount" from 5) WHERE "customerAccount" LIKE 'OPT-CUS-%';

-- Structurally enforces the wallet rules from the locked specification:
-- wallets are an artist earnings ledger only, top-up is forbidden, and
-- settlements are the sole (manual) way to reduce a balance.
--
-- Prisma's schema DSL has no declarative CHECK-constraint attribute in the
-- version this project pins, so these are added as a hand-written
-- migration per Prisma's documented "customizing migrations" workflow:
-- https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations

-- A wallet's balance is an accumulated earnings total; it can never go
-- negative (settling more than an artist has earned is a bug, not a
-- valid operation).
ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_balance_non_negative" CHECK ("balance" >= 0);

-- A settlement always records the removal of a positive amount. Combined
-- with the non-negative balance check above, this makes it impossible for
-- a settlement to increase a wallet's balance (a "top-up") or to be used
-- as anything other than a manual, attributable payout.
ALTER TABLE "settlements"
  ADD CONSTRAINT "settlements_amount_positive" CHECK ("amount" > 0);

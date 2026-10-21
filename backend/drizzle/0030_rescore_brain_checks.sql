-- Brain speed rescored for phones (domain/brainCheck.ts scoreCheck): a rested median of 300 ms,
-- a point per 4 ms slower, up to 50 off for lapses and 2 per false start (at most 20).
UPDATE "brain_checks"
SET "score" = greatest(0, least(100, round(
  100
  - greatest(0, "median_ms" - 300) / 4.0
  - "lapses" * 50.0 / "trials"
  - least("false_starts" * 2, 20)
)));

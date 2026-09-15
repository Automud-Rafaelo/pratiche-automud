import assert from "node:assert/strict";
import test from "node:test";

import {
  createPracticeIdempotently,
  formatRecentPracticeAge,
  isValidPracticeCreationToken,
} from "../src/lib/domain/practice-creation.ts";

const input = {
  creationToken: "creation_token_abcdefghijklmnopqrstuvwxyz123456",
  type: "dini",
  price: 1200,
  plate: "FA483PM",
  make: "Audi",
  model: "A3",
};

test("creates only one practice when the idempotency token is submitted twice", async () => {
  const records = new Map();
  let insertCount = 0;
  const repository = {
    async findByCreationToken(token) {
      return records.get(token) ?? null;
    },
    async insert(value) {
      insertCount += 1;
      const practice = { id: "practice-1" };
      records.set(value.creationToken, practice);
      return practice;
    },
  };

  const first = await createPracticeIdempotently(input, repository);
  const second = await createPracticeIdempotently(input, repository);

  assert.deepEqual(first, {
    practice: { id: "practice-1" },
    created: true,
  });
  assert.deepEqual(second, {
    practice: { id: "practice-1" },
    created: false,
  });
  assert.equal(insertCount, 1);
});

test("recovers the winning practice after a concurrent unique conflict", async () => {
  let lookupCount = 0;
  const repository = {
    async findByCreationToken() {
      lookupCount += 1;
      return lookupCount === 1 ? null : { id: "practice-winner" };
    },
    async insert() {
      return null;
    },
  };

  assert.deepEqual(
    await createPracticeIdempotently(input, repository),
    {
      practice: { id: "practice-winner" },
      created: false,
    },
  );
});

test("validates creation tokens and formats the recent-practice age", () => {
  assert.equal(isValidPracticeCreationToken(input.creationToken), true);
  assert.equal(isValidPracticeCreationToken("short"), false);
  assert.equal(
    formatRecentPracticeAge(
      "2026-09-15T08:00:00.000Z",
      Date.parse("2026-09-15T08:02:30.000Z"),
    ),
    "2 minuti fa",
  );
});

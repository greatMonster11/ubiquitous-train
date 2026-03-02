import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  findEmailCoordinates,
  findLinkedInTextCoordinates,
  findPhoneCoordinates,
} from "./extractor.js";

function token(str, x, y, page = 1, width = 6, height = 10, fontSize = 10) {
  return { str, x, y, page, width, height, fontSize };
}

test("findEmailCoordinates handles split email tokens", () => {
  const tokens = [
    token("john", 10, 700),
    token(".", 35, 700),
    token("doe", 40, 700),
    token("@", 63, 699.6),
    token("gmail", 71, 699.7),
    token(".", 105, 699.7),
    token("com", 109, 699.7),
  ];

  const coordinates = findEmailCoordinates(tokens);
  assert.equal(coordinates.length, 1);
  assert.equal(coordinates[0].str, "john.doe@gmail.com");
  assert.equal(coordinates[0].page, 1);
  assert.ok(coordinates[0].width > 0);
  assert.ok(coordinates[0].height > 0);
});

test("findPhoneCoordinates accepts valid numbers and rejects date-like values", () => {
  const tokens = [
    token("Phone", 10, 660),
    token(":", 35, 660),
    token("+84", 45, 660),
    token("901", 68, 660),
    token("234", 92, 660),
    token("567", 116, 660),
    token("2019-2023", 10, 640),
  ];

  const coordinates = findPhoneCoordinates(tokens);
  assert.equal(coordinates.length, 1);
  assert.equal(coordinates[0].str, "+84 901 234 567");
});

test("findLinkedInTextCoordinates detects linkedin and lnkd.in text", () => {
  const tokens = [
    token("linkedin.com/in/first-last", 10, 620),
    token("lnkd.in/abCD12", 10, 600),
  ];

  const coordinates = findLinkedInTextCoordinates(tokens);
  assert.equal(coordinates.length, 2);
});

test("detectors do not mutate source token coordinates", () => {
  const tokens = [
    token("mail", 10, 500),
    token("@", 34, 500),
    token("acme", 40, 500),
    token(".", 65, 500),
    token("io", 69, 500),
  ];
  const before = JSON.parse(JSON.stringify(tokens));

  findEmailCoordinates(tokens);
  findPhoneCoordinates(tokens);

  assert.deepEqual(tokens, before);
});

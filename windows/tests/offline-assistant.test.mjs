import test from "node:test";
import assert from "node:assert/strict";
import { handleOfflineQuery } from "../src/core/offline-assistant.ts";

test("offline assistant replies to greetings", () => {
  const res = handleOfflineQuery("hello");
  assert.equal(res.handled, true);
  assert.match(res.reply, /Day/);
});

test("offline assistant answers time and date", () => {
  const timeRes = handleOfflineQuery("what time is it");
  assert.equal(timeRes.handled, true);
  assert.match(timeRes.reply, /Local Time/);

  const dateRes = handleOfflineQuery("today");
  assert.equal(dateRes.handled, true);
  assert.match(dateRes.reply, /Today is/);
});

test("offline assistant handles arithmetic calculations safely", () => {
  const res = handleOfflineQuery("calculate 25 * 4 + 10");
  assert.equal(res.handled, true);
  assert.match(res.reply, /110/);

  const pct = handleOfflineQuery("20% of 500");
  assert.equal(pct.handled, true);
  assert.match(pct.reply, /100/);
});

test("offline assistant manages local notes", () => {
  const save = handleOfflineQuery("note: Test offline note");
  assert.equal(save.handled, true);
  assert.match(save.reply, /Note saved locally/);

  const list = handleOfflineQuery("show notes");
  assert.equal(list.handled, true);
  assert.match(list.reply, /Test offline note/);

  const clear = handleOfflineQuery("clear notes");
  assert.equal(clear.handled, true);
  assert.match(clear.reply, /cleared/);
});

test("offline assistant gives helpful offline guidance for general prompts", () => {
  const res = handleOfflineQuery("explain quantum computing");
  assert.equal(res.handled, false);
  assert.match(res.reply, /Local Offline Mode/);
  assert.match(res.reply, /Ollama/);
});

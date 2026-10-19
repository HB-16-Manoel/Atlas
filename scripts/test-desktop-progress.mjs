/** Isolated desktop browser regression: builds against a local mock API; never contacts Supabase. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3010";
const api = "http://127.0.0.1:3011";
const userId = "11111111-1111-4111-8111-111111111111";
const today = new Date().toISOString().slice(0, 10);
const now = new Date().toISOString();
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "desktop-test@example.invalid",
  app_metadata: {},
  user_metadata: {},
  created_at: now,
};
const jwt = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: userId, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.isolated-test`;
const session = {
  access_token: jwt,
  refresh_token: "isolated-test",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user,
};
const tables = {
  tasks: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      user_id: userId,
      title: "Existing task",
      task_date: today,
      position: 0,
      carry_over: false,
      completed_at: null,
      revision: 1,
      created_at: now,
      deleted_at: null,
    },
  ],
  habits: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      user_id: userId,
      name: "Existing habit",
      started_on: today,
      position: 0,
      revision: 1,
      created_at: now,
      deleted_at: null,
    },
  ],
  habit_completions: [],
  events: [],
  journal_entries: [],
  task_activity: [],
  goals: [],
  goal_milestones: [],
  goal_task_links: [],
  goal_habit_links: [],
};
let failSave = false;
const requests = [];
const matches = (row, params) =>
  [...params].every(([key, filter]) => {
    if (filter.startsWith("eq.")) return String(row[key]) === filter.slice(3);
    if (filter === "is.null") return row[key] == null;
    return true;
  });
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] ||
      "authorization,apikey,content-type,x-client-info,prefer,accept-profile,content-profile,x-supabase-api-version",
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS",
  );
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  const url = new URL(req.url, api);
  if (url.pathname === "/auth/v1/user") {
    res.end(JSON.stringify(user));
    return;
  }
  if (url.pathname === "/auth/v1/token") {
    res.end(JSON.stringify(session));
    return;
  }
  const name = url.pathname.split("/").at(-1);
  if (!(name in tables)) {
    res.statusCode = 404;
    res.end(JSON.stringify({ message: "Unexpected mock endpoint" }));
    return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  const input = body ? JSON.parse(body) : null;
  requests.push({
    method: req.method,
    table: name,
    params: Object.fromEntries(url.searchParams),
    input,
  });
  if (failSave && req.method !== "GET") {
    failSave = false;
    res.statusCode = 503;
    res.end(JSON.stringify({ message: "Test save unavailable" }));
    return;
  }
  let rows = tables[name].filter((row) => matches(row, url.searchParams));
  if (req.method === "POST") {
    rows = (Array.isArray(input) ? input : [input]).map((row) => ({
      created_at: now,
      revision: 1,
      deleted_at: null,
      completed_at: null,
      ...row,
    }));
    tables[name].push(...rows);
  } else if (req.method === "PATCH") {
    for (const row of rows)
      Object.assign(row, input, { revision: row.revision + 1 });
  } else if (req.method === "DELETE")
    tables[name] = tables[name].filter((row) => !rows.includes(row));
  res.end(JSON.stringify(rows));
});
await new Promise((resolve) => server.listen(3011, "127.0.0.1", resolve));
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: api,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_isolated_test",
};
let app;
let browser;
let page;
try {
  if (!process.env.ATLAS_SKIP_TEST_BUILD) {
    const build = spawnSync(
      process.execPath,
      ["node_modules/next/dist/bin/next", "build"],
      { env, stdio: "inherit" },
    );
    assert.equal(build.status, 0, "test production build failed");
  }
  app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      "3010",
      "-H",
      "127.0.0.1",
    ],
    { env, stdio: "pipe" },
  );
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await pause(100);
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.ATLAS_CHROMIUM_EXECUTABLE
      ? {
          executablePath: process.env.ATLAS_CHROMIUM_EXECUTABLE,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--no-zygote",
            "--single-process",
          ],
        }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("console", (message) => {
    if (message.type() === "error") console.error("Browser:", message.text());
  });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${origin}/auth/login`);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.locator('input[type="password"]').fill("Isolated-test-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(`${origin}/`);
  assert.equal(
    new URL(page.url()).origin,
    origin,
    "password login stays on the same origin",
  );
  console.log(
    "PASS: email/password login and authenticated data initialization",
  );
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page.getByRole("button", { name: "New goal", exact: true }).waitFor();
  const scroller = page.locator("[data-progress-scroll]");
  const openGoal = async () => {
    await page.getByRole("button", { name: "New goal", exact: true }).click();
    await page.getByRole("dialog").waitFor();
  };
  const dialog = page.getByRole("dialog");

  await openGoal();
  assert.equal(
    await dialog.getByRole("radio", { name: /Milestone-based/ }).isChecked(),
    true,
  );
  assert.equal(await dialog.getByLabel("Target", { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.name), "title");
  await dialog.getByRole("button", { name: "Save goal", exact: true }).click();
  assert.equal(await dialog.getByText("Enter a goal title.").isVisible(), true);
  await dialog.getByLabel("Title", { exact: true }).fill("Milestone outcome");
  await dialog.getByRole("button", { name: "Save goal", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  const milestoneCard = page.getByRole("article", {
    name: "Milestone outcome",
    exact: true,
  });
  await milestoneCard.waitFor();
  assert.equal(
    await milestoneCard
      .getByRole("button", { name: "Delete goal", exact: true })
      .isVisible(),
    false,
  );
  await milestoneCard.locator("summary").filter({ hasText: "Details" }).click();
  await milestoneCard
    .getByLabel("New milestone for Milestone outcome")
    .fill("First step");
  await milestoneCard.getByRole("button", { name: "Add", exact: true }).click();
  await milestoneCard
    .getByRole("checkbox", { name: "Complete First step", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[aria-label="Milestone outcome progress"]')
        .getAttribute("aria-valuenow") === "100",
  );
  await milestoneCard.locator("summary").filter({ hasText: "Link task" }).click();
  await milestoneCard.getByLabel("Search tasks to link to Milestone outcome").fill("Existing");
  await milestoneCard.getByRole("button", { name: /Existing task/ }).click();
  await milestoneCard.locator("summary").filter({ hasText: "Link habit" }).click();
  await milestoneCard.getByLabel("Search habits to link to Milestone outcome").fill("Existing");
  await milestoneCard.getByRole("button", { name: /Existing habit/ }).click();
  await milestoneCard
    .getByRole("button", { name: "Unlink Existing habit", exact: true })
    .waitFor();
  assert.equal(tables.goal_task_links.length, 1);
  assert.equal(tables.goal_habit_links.length, 1);
  assert.equal(
    tables.tasks[0].completed_at,
    null,
    "linking must not complete a task",
  );
  await milestoneCard
    .getByRole("button", { name: "Edit goal", exact: true })
    .click();
  await dialog
    .getByLabel("Title", { exact: true })
    .fill("Edited milestone outcome");
  await dialog.getByLabel("Status", { exact: true }).selectOption("paused");
  assert.equal(
    await dialog.getByText("Milestone-based goal", { exact: true }).isVisible(),
    true,
  );
  await dialog.getByRole("button", { name: "Save goal", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(tables.goals[0].status, "paused");
  console.log("PASS: milestone editor, completion, status, and activity links");

  await openGoal();
  await dialog.getByRole("radio", { name: /Measurable/ }).check();
  await dialog.getByRole("button", { name: "Save goal", exact: true }).click();
  assert.equal(
    await dialog.getByText(/Enter a target greater than zero/).isVisible(),
    true,
  );
  await dialog.getByLabel("Title", { exact: true }).fill("Read books");
  await dialog.getByLabel("Target", { exact: true }).fill("12");
  await dialog.getByLabel("Current value", { exact: true }).fill("3");
  await dialog.getByLabel("Unit", { exact: true }).fill("books");
  failSave = true;
  await dialog.getByRole("button", { name: "Save goal", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(
    await dialog.getByLabel("Title", { exact: true }).inputValue(),
    "Read books",
  );
  await dialog.getByRole("button", { name: "Save goal", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  const measurable = page.getByRole("article", {
    name: "Read books",
    exact: true,
  });
  await measurable.waitFor();
  assert.equal(
    await measurable.getByRole("progressbar").getAttribute("aria-valuenow"),
    "25",
  );
  await measurable
    .locator("summary")
    .filter({ hasText: "Update value" })
    .click();
  await measurable.getByLabel("Current value", { exact: true }).fill("6");
  await measurable.getByRole("button", { name: "Update", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[aria-label="Read books progress"]')
        .getAttribute("aria-valuenow") === "50",
  );
  await measurable.locator("summary").filter({ hasText: "Details" }).click();
  await measurable
    .getByRole("button", { name: "Edit goal", exact: true })
    .click();
  await dialog.getByLabel("Target", { exact: true }).fill("20");
  await dialog.getByLabel("Status", { exact: true }).selectOption("completed");
  await dialog.getByRole("button", { name: "Save goal", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(tables.goals[1].target_value, 20);
  assert.equal(tables.goals[1].status, "completed");
  console.log(
    "PASS: measurable editor, value updates, and save error recovery",
  );

  // A background refresh must not silently upgrade the revision of an open edit.
  await measurable
    .getByRole("button", { name: "Edit goal", exact: true })
    .click();
  const editingRevision = tables.goals[1].revision;
  tables.goals[1].revision++;
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/goals?") &&
      response.request().method() === "GET",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await refreshed;
  await dialog
    .getByLabel("Title", { exact: true })
    .fill("Unsaved conflicting title");
  await dialog.getByRole("button", { name: "Save goal", exact: true }).click();
  await dialog
    .getByRole("alert")
    .filter({ hasText: "changed on another device" })
    .waitFor();
  assert.equal(tables.goals[1].title, "Read books");
  assert.equal(
    requests
      .filter(
        (request) => request.method === "PATCH" && request.table === "goals",
      )
      .at(-1).params.revision,
    `eq.${editingRevision}`,
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });

  await openGoal();
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await dialog
      .getByRole("button", { name: "Save goal", exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() =>
        document.querySelector("dialog[open]").contains(document.activeElement),
      ),
      true,
      "focus must remain in modal",
    );
  }
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByRole("button", { name: "New goal", exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await openGoal();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });

  if (process.env.ATLAS_TEST_SCREENSHOTS)
    await page.screenshot({
      path: `${process.env.ATLAS_TEST_SCREENSHOTS}/goals-desktop.png`,
    });
  await page.reload();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page
    .getByRole("article", { name: "Edited milestone outcome", exact: true })
    .waitFor();
  assert.equal(tables.goal_task_links.length, 1, "reload retains links");
  const bounds = async () =>
    scroller.evaluate((element) => ({
      height: element.clientHeight,
      width: element.clientWidth,
      scrollHeight: element.scrollHeight,
      scrollWidth: element.scrollWidth,
      top: element.scrollTop,
      body: document.documentElement.scrollHeight,
      viewport: innerHeight,
    }));
  for (const [width, height, label] of [
    [1920, 1280, "tall desktop"],
    [1920, 1080, "1080p"],
    [1536, 864, "1536x864"],
    [1440, 900, "900p"],
    [1366, 768, "768p"],
    [1280, 720, "720p"],
    [1024, 640, "compact"],
    [960, 540, "1080p at 200% CSS viewport"],
  ]) {
    await page.setViewportSize({ width, height });
    await scroller.evaluate((element) => element.scrollTo({ top: 0, behavior: "instant" }));
    await pause(200);
    const before = await bounds();
    if (process.env.ATLAS_TEST_SCREENSHOTS && width === 1440)
      await page.screenshot({
        path: `${process.env.ATLAS_TEST_SCREENSHOTS}/analytics-desktop.png`,
      });
    assert.equal(
      before.height,
      height,
      `${label}: scroller uses actual viewport`,
    );
    assert.ok(
      before.body <= height + 1,
      `${label}: document must not form a second scroll area`,
    );
    assert.ok(
      before.scrollWidth <= before.width + 1,
      `${label}: no horizontal overflow`,
    );
    assert.ok(before.top <= 1, `${label}: Analytics begins at top`);
    const insight = page.locator("[data-atlas-insight]");
    if (width === 1536) {
      const consistencyRect = await page.locator("[data-consistency-card]").boundingBox();
      const insightRect = await page.locator("[data-atlas-insight]").boundingBox();
      assert.ok(consistencyRect.y + consistencyRect.height <= insightRect.y, "Consistency and Atlas Insight must not overlap");
      if (process.env.ATLAS_TEST_SCREENSHOTS)
        await page.screenshot({ path: `${process.env.ATLAS_TEST_SCREENSHOTS}/analytics-1536x864.png` });
    }
    const snapType = await scroller.evaluate(
      (element) => getComputedStyle(element).scrollSnapType,
    );
    assert.equal(snapType, "y mandatory", `${label}: section scrolling snaps to a section`);
    assert.equal(await page.getByRole("button", { name: "Analytics", exact: true }).count(), 0, "desktop has no return control");
    await scroller.hover();
    if (label === "tall desktop") {
      await page.mouse.wheel(0, 270);
      await pause(650);
      const settled = await bounds();
      const goalsTop = await page.locator('[data-progress-section="goals"]').evaluate(
        (element) => element.offsetTop,
      );
      assert.ok(
        settled.top <= 2 || Math.abs(settled.top - goalsTop) <= 2,
        "wheel idle position settles on a section boundary",
      );
      await scroller.evaluate((element) => element.scrollTo({ top: 0, behavior: "instant" }));
    }
    const consistency = page.locator("[data-consistency-card]");
    let consistencyVisible = false;
    for (let step = 0; step < 40; step++) {
      const rect = await consistency.boundingBox();
      if (rect.y >= 0 && rect.y + rect.height <= height) {
        consistencyVisible = true;
        break;
      }
      await page.mouse.wheel(0, 70);
      await pause(50);
    }
    assert.ok(consistencyVisible, `${label}: entire Consistency card is reachable`);
    // Small deltas model progressive wheel/trackpad scrolling through Analytics,
    // rather than one large jump that could hide a skipped Insight card.
    let insightVisible = false;
    for (let step = 0; step < 40; step++) {
      const rect = await insight.boundingBox();
      if (rect.y >= 0 && rect.y + rect.height <= height) {
        insightVisible = true;
        break;
      }
      await page.mouse.wheel(0, 70);
      await pause(50);
    }
    assert.equal(
      insightVisible,
      true,
      `${label}: all of Atlas Insight is reachable before Goals`,
    );
    const goalsRect = await page
      .locator('[data-progress-section="goals"]')
      .boundingBox();
    assert.ok(
      goalsRect.y >= 0,
      `${label}: scrolling to Insight must not skip Analytics`,
    );
    if (process.env.ATLAS_TEST_SCREENSHOTS && width === 1366)
      await page.screenshot({
        path: `${process.env.ATLAS_TEST_SCREENSHOTS}/analytics-insight-reachable.png`,
      });
    await page.getByRole("button", { name: "Goals", exact: true }).click();
    await pause(150);
    const after = await bounds();
    assert.ok(after.top > 0, `${label}: Goals control scrolls down`);
    await scroller.hover();
    await page.mouse.wheel(0, -10000);
    await pause(550);
    assert.ok(
      (await bounds()).top <= 1,
      `${label}: wheel returns to Analytics`,
    );
    await page.mouse.wheel(0, 10000);
    await pause(550);
    assert.ok((await bounds()).top > 0, `${label}: wheel reaches Goals`);
    await openGoal();
    const modalBounds = await dialog.boundingBox();
    assert.ok(
      modalBounds.y >= 0 && modalBounds.y + modalBounds.height <= height,
      `${label}: editor fits viewport`,
    );
    const backgroundTop = (await bounds()).top;
    await dialog.hover();
    await page.mouse.wheel(0, 10000);
    await pause(100);
    const saveBounds = await dialog
      .getByRole("button", { name: "Save goal", exact: true })
      .boundingBox();
    assert.ok(
      saveBounds.y + saveBounds.height <= height,
      `${label}: modal footer remains reachable`,
    );
    assert.equal(
      (await bounds()).top,
      backgroundTop,
      `${label}: modal scroll does not move the page`,
    );
    if (process.env.ATLAS_TEST_SCREENSHOTS && width === 960)
      await page.screenshot({
        path: `${process.env.ATLAS_TEST_SCREENSHOTS}/editor-short-viewport.png`,
      });
    await page.keyboard.press("Escape");
    console.log(`PASS: ${label}`);
  }
  await scroller.evaluate((element) => element.scrollTo({ top: 0, behavior: "instant" }));
  for (const [name, text] of [
    ["Week", "Last 7 days"],
    ["Month", "Last 30 days"],
    ["3 Months", "Last 12 weeks"],
    ["Year", "Last 12 months"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    assert.equal(
      await page.getByText(text, { exact: true }).isVisible(),
      true,
      `${name}: graph period changes`,
    );
  }
  await page.getByRole("button", { name: "Goals", exact: true }).click();
  const editedMilestoneCard = page.getByRole("article", { name: "Edited milestone outcome", exact: true });
  await editedMilestoneCard.locator("summary").filter({ hasText: "Details" }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await editedMilestoneCard.getByRole("button", { name: "Delete", exact: true }).last().click();
  assert.equal(tables.goals[0].deleted_at, null, "cancel keeps the goal");
  page.once("dialog", (dialog) => dialog.accept());
  await editedMilestoneCard.getByRole("button", { name: "Delete", exact: true }).last().click();
  await editedMilestoneCard.waitFor({ state: "hidden" });
  assert.ok(tables.goals[0].deleted_at, "confirmed deletion persists");
  console.log("PASS: visible deletion control, cancel and confirmed delete");
  // Clear the cookie session before opening a fresh callback page. Reuse the
  // browser context so this also runs in constrained single-process Chromium.
  const callbackContext = context;
  await callbackContext.clearCookies();
  await callbackContext.addCookies([
    {
      name: "sb-127-auth-token-code-verifier",
      value: `base64-${Buffer.from(JSON.stringify("isolated-verifier")).toString("base64url")}`,
      url: origin,
    },
  ]);
  const callbackPage = await callbackContext.newPage();
  await callbackPage.goto(`${origin}/auth/callback?code=isolated-code&next=/`);
  await callbackPage.waitForURL(`${origin}/`);
  await callbackPage
    .getByRole("button", { name: "Progress", exact: true })
    .click();
  await callbackPage
    .getByRole("article", { name: "Read books", exact: true })
    .waitFor();
  assert.equal(new URL(callbackPage.url()).origin, origin);
  await callbackPage.close();
  console.log(
    "PASS: callback exchange, session cookies, AuthProvider and cloud Goals initialization",
  );
  assert.equal(pageErrors.length, 0, pageErrors.join("\n"));
  assert.ok(
    requests.some(
      (request) =>
        request.table === "goals" &&
        request.method === "PATCH" &&
        request.params.revision,
    ),
    "edits retain revision checks",
  );
  console.log(
    "PASS: goal creation/editing (both types), validation/server errors, status/selects, milestones, linking, persistence, modal focus/Escape/Cancel, section controls/wheel, seven desktop viewport sizes, chart filters.",
  );
} catch (error) {
  console.error(
    "UI at failure:",
    page && !page.isClosed()
      ? await page
          .locator("body")
          .innerText()
          .catch(() => "unavailable")
      : "page closed",
  );
  console.error(
    "Mock requests:",
    requests.slice(-20).map(({ method, table }) => ({ method, table })),
  );
  throw error;
} finally {
  await browser?.close();
  app?.kill();
  server.close();
}

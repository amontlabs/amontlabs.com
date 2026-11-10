#!/usr/bin/env node
// Build src/data/activity.json from the public GitHub API: what happened in github.com/amontlabs over the last
// 30 days, reduced to what a visitor can read at a glance (Node 22+; GITHUB_TOKEN advised: a busy repo needs a
// dozen requests).
//   scope      every public repository of the organisation with commits in the window, except EXCLUDE. Private,
//              archived and forked repositories are never read.
//   per repo   commits per day (30 values), totals for 30 and 7 days
//   journal    one entry per active day, newest first: which projects moved and by how much, what was released,
//              and one short summary of the day written by Claude. The model is reached with ANTHROPIC_API_KEY
//              (the API, through the SDK) or, without one, with CLAUDE_CODE_OAUTH_TOKEN (a Claude subscription,
//              through the Claude Code CLI; the token comes from `claude setup-token`). With neither, the
//              journal quotes pull request titles instead.
//   summaries  kept in src/data/activity-summaries.json with a hash of what they were written from. A day is sent
//              to the model once, and again only if its commits, pull requests or releases changed: in practice
//              the current day on each run, and each day one last time after it ends.
// What the model is given for a day: every active project's description and the start of its README, the last
// three summaries, and per project the merged pull requests (title and description), the commit messages and the
// release notes. `--dry=<file>` writes those requests to a file without calling the model, to read or to size them.
// Days are Europe/Paris days. Always exits 0; a repo the API could not reach keeps its previous data.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

// not project work: the organisation profile, this site, and the brand repository
const EXCLUDE = new Set([".github", "amontlabs.com", "amont"]);
// names as the site writes them; any other repository goes by its GitHub name
const NAMES = { silo: "Silo", fjord: "Fjord", sic: "Sic", lcu: "LCU", lastdrop: "lastdrop", hartlib: "Hartlib" };
const FILE = new URL("../src/data/activity.json", import.meta.url);
const SUMMARIES = new URL("../src/data/activity-summaries.json", import.meta.url);
const MODEL = process.env.ACTIVITY_MODEL ?? "claude-opus-5-5";
const DRY = process.argv.find((a) => a.startsWith("--dry="))?.slice(6);
const VIA = process.env.ANTHROPIC_API_KEY
  ? "api"
  : process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ACTIVITY_VIA === "claude-code"
    ? "claude-code"
    : null;
const DAYS = 30,
  LOG_DAYS = 30;
// per project and day, the model reads at most this many commit messages (the rest are counted, and it is told so)
const MAX_COMMITS = 120;
const headers = { Accept: "application/vnd.github+json", "User-Agent": "amontlabs.com" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const paris = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayOf = (iso) => paris.format(new Date(iso));
const now = new Date();
const days = Array.from({ length: DAYS }, (_, i) => dayOf(new Date(now.getTime() - (DAYS - 1 - i) * 864e5)));
const since = new Date(now.getTime() - (DAYS + 1) * 864e5).toISOString();
const logDays = days.slice(-LOG_DAYS);

const api = (path) => `https://api.github.com/${path.startsWith("orgs/") ? "" : "repos/amontlabs/"}${path}`;
const get = async (path) => {
  const out = [];
  for (let page = 1; page <= 30; page++) {
    const r = await fetch(`${api(path)}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`, { headers });
    if (!r.ok) throw new Error(`${path} ${r.status}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out;
};
const first = (m) => m.split("\n")[0].trim();
const rest = (m) => m.split("\n").slice(1).join("\n").trim();
const cut = (s, n) => (s && s.length > n ? `${s.slice(0, n)} […]` : (s ?? ""));
const noise = (s) => /^(merge\b|chore(\(.*\))?:|ci(\(.*\))?:|docs\(release\)|bump\b)/i.test(s);
const tidy = (s) => s.replace(/\s*\(#\d+\)$/, "");
const bot = (login) => !login || /\[bot\]$/.test(login);
const read = (url) => {
  try {
    return JSON.parse(readFileSync(url, "utf8"));
  } catch {
    return {};
  }
};
const prev = read(FILE);
const cache = read(SUMMARIES);

let list = Object.keys(prev.repos ?? {}).map((name) => ({ name, description: "" }));
try {
  list = (await get("orgs/amontlabs/repos?type=public")).filter(
    (r) => !r.private && !r.archived && !r.fork && !EXCLUDE.has(r.name),
  );
} catch (e) {
  console.error("repository list not updated:", e.message);
}

const repos = {},
  people = new Set(),
  about = {},
  // day -> repo -> what happened
  book = new Map(logDays.map((d) => [d, new Map()]));
let commitsAll = 0,
  releasesAll = 0,
  mergedAll = 0;
const failed = new Set();
for (const { name, description } of list) {
  try {
    const [commits, pulls, releases] = await Promise.all([
      get(`${name}/commits?since=${since}`),
      get(`${name}/pulls?state=closed&sort=updated&direction=desc`),
      get(`${name}/releases`),
    ]);
    const daily = days.map(() => 0);
    const merged = pulls.filter((p) => p.merged_at && days.includes(dayOf(p.merged_at)));
    const rels = releases.filter(
      (r) => !r.draft && !r.prerelease && /^v\d/.test(r.tag_name) && days.includes(dayOf(r.published_at)),
    );
    const page = (d) => {
      if (!book.has(d)) return null;
      if (!book.get(d).has(name)) book.get(d).set(name, { n: 0, commits: [], pulls: [], releases: [] });
      return book.get(d).get(name);
    };
    for (const c of commits) {
      const d = dayOf(c.commit.author.date),
        i = days.indexOf(d);
      if (i < 0) continue;
      daily[i]++;
      if (!bot(c.author?.login)) people.add(c.author.login);
      const p = page(d);
      if (!p) continue;
      p.n++;
      if (!noise(first(c.commit.message))) p.commits.push(c.commit.message);
    }
    for (const p of merged) {
      if (!bot(p.user?.login)) people.add(p.user.login);
      page(dayOf(p.merged_at))?.pulls.push(p);
    }
    for (const r of rels) page(dayOf(r.published_at))?.releases.push(r);
    const total = daily.reduce((a, b) => a + b, 0);
    if (!total && !merged.length && !rels.length) continue;
    about[name] = description ?? "";
    repos[name] = {
      name: NAMES[name] ?? name,
      daily,
      commits: total,
      week: daily.slice(-7).reduce((a, b) => a + b, 0),
      merged: merged.length,
      releases: rels.length,
    };
    commitsAll += total;
    mergedAll += merged.length;
    releasesAll += rels.length;
  } catch (e) {
    console.error(`${name} not updated:`, e.message);
    failed.add(name);
    if (prev.repos?.[name]) repos[name] = prev.repos[name];
  }
}

// ---- the journal: one entry per active day
const quiet = (p) => bot(p.user?.login) || noise(p.title) || /^(docs|test|build)(\(.*\))?:/i.test(p.title);
const journal = [],
  material = new Map();
for (const d of [...logDays].reverse()) {
  const pages = [...book.get(d)].sort((a, b) => b[1].n - a[1].n);
  if (!pages.length) continue;
  journal.push({
    day: d,
    repos: pages.map(([repo, p]) => ({ repo, n: p.n, merged: p.pulls.length })),
    releases: pages
      .filter(([, p]) => p.releases.length)
      .map(([repo, p]) => {
        const r = p.releases.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
        return {
          repo,
          to: r.at(-1).tag_name,
          from: r.length > 1 ? r[0].tag_name : null,
          n: r.length,
          url: r.at(-1).html_url,
        };
      }),
    // without a summary the entry quotes the day's first pull requests, people's work before chores
    highlights: pages
      .flatMap(([repo, p]) => p.pulls.filter((x) => !quiet(x)).map((x) => ({ repo, text: x.title, url: x.html_url })))
      .slice(0, 3),
  });
  material.set(
    d,
    pages
      .filter(([, p]) => p.commits.length || p.pulls.length || p.releases.length)
      .map(([repo, p]) => ({
        repository: repo,
        name: NAMES[repo] ?? repo,
        commits_total: p.n,
        pull_requests_merged: p.pulls
          .sort((a, b) => quiet(a) - quiet(b))
          .map((x) => ({ title: x.title, description: cut(x.body, 1500) })),
        commits: p.commits
          .slice(0, MAX_COMMITS)
          .map((m) => ({ subject: tidy(first(m)), body: cut(rest(m), 400) || undefined })),
        commits_not_shown: Math.max(0, p.commits.length - MAX_COMMITS) || undefined,
        releases: p.releases.map((x) => ({ version: x.tag_name, notes: cut(x.body, 800) })),
      })),
  );
}
// a day of a repo that could not be read keeps what the site already says about it
if (failed.size)
  for (const e of prev.journal ?? [])
    if (!journal.some((x) => x.day === e.day) && logDays.includes(e.day)) journal.push(e);
journal.sort((a, b) => (a.day < b.day ? 1 : -1));

// ---- summaries: one per day, written once and again only when the day's content changed
const SYSTEM = `You write the daily activity journal on amontlabs.com, the site of Amont Labs, a small lab building what AI agents need to do real work. Visitors who have never seen these repositories read the journal to learn what the lab is working on and how much is happening. They are technical, but they do not know the projects' internals.

You receive one day of work as JSON: for each project that moved, what the project is (its description and the start of its README), its merged pull requests with their descriptions, its commit messages, and any releases with their notes. You also receive the previous days' summaries, so that you can say when work continues or lands rather than repeat yourself. If "day_is_over" is false, the day is still going and you are describing it so far.

Write the summary of that day for a reader who knows nothing about these projects:

- Be concise and very simple: one or two short sentences, at most 200 characters in total. Plain text, no markdown, no lists.
- Use everyday words. Say what a project can now do or what was fixed, the way you would tell a friend who does not work on it. No internal names, phase codes, file names or jargon; if a term would need explaining, say the plain thing instead. Use the README to understand the project's vocabulary, then leave that vocabulary out.
- Pick the one or two things that matter most that day and leave the rest out. A project with only housekeeping (formatting, CI, dependency bumps, release chores, review follow-ups) can be left out entirely.
- Name each project you mention by its "name", written exactly that way.
- Mention a release only when it is the news of the day; releases are listed next to your text.
- State only what the material supports. Never add a purpose, a benefit, a number or a claim that is not in it, and do not judge the work ("major", "powerful"). The text is published without review, so anything not in the input would be an invented claim on the lab's own site.
- Past tense, no "we", no "the team", no "today".`;
const hash = (m) => createHash("sha1").update(JSON.stringify(m)).digest("hex");
const summaries = {};
for (const [d, m] of material) if (cache[d]?.hash === hash(m)) summaries[d] = cache[d];
const pending = [...material].filter(([d, m]) => !summaries[d] && m.length).reverse(); // oldest first
const readmes = {};
const readme = async (repo) => {
  if (!(repo in readmes)) {
    const r = await fetch(api(`${repo}/readme`), { headers: { ...headers, Accept: "application/vnd.github.raw+json" } });
    readmes[repo] = r.ok ? cut(await r.text(), 2500) : "";
  }
  return readmes[repo];
};
const today = days.at(-1);
const request = async (d, m) => ({
  day: d,
  weekday: new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)),
  day_is_over: d !== today,
  previous_summaries: Object.entries({ ...cache, ...summaries })
    .filter(([k]) => k < d)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 3)
    .map(([k, v]) => ({ day: k, text: v.text })),
  projects: await Promise.all(
    m.map(async (x) => ({
      repository: x.repository,
      name: x.name,
      description: about[x.repository],
      readme_start: await readme(x.repository),
    })),
  ),
  activity: m,
});
if (DRY) {
  const out = [];
  for (const [d, m] of pending) out.push({ hash: hash(m), request: await request(d, m) });
  writeFileSync(DRY, JSON.stringify(out, null, 1));
  for (const o of out)
    console.log(o.request.day, `~${Math.round((SYSTEM.length + JSON.stringify(o.request).length) / 4)} input tokens`);
} else if (pending.length && VIA === "claude-code") {
  // a Claude subscription: the Claude Code CLI as a plain model call, with no tools and only this system prompt
  for (const [d, m] of pending) {
    try {
      const run = spawnSync(
        "claude",
        ["-p", "--model", MODEL, "--system-prompt", `${SYSTEM}\n\nReply with the summary text and nothing else.`, "--tools", "", "--output-format", "json", "--no-session-persistence", "--strict-mcp-config", "--disable-slash-commands"],
        { input: JSON.stringify(await request(d, m)), encoding: "utf8", timeout: 300000, maxBuffer: 1 << 24, cwd: tmpdir() },
      );
      if (run.status !== 0) throw new Error(run.stderr?.trim().slice(0, 300) || run.error?.message || `exit ${run.status}`);
      const res = JSON.parse(run.stdout);
      const text = String(res.result ?? "").trim();
      if (res.is_error || !text || text.length > 300) throw new Error(`unusable summary: ${text.slice(0, 120)}`);
      summaries[d] = { hash: hash(m), text };
      console.log(`${d} summarised: ${JSON.stringify(res.usage ?? {}).slice(0, 200)}`);
    } catch (e) {
      console.error(`${d} not summarised:`, e.message);
      if (cache[d]) summaries[d] = cache[d];
    }
  }
} else if (pending.length && VIA === "api") {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  for (const [d, m] of pending) {
    try {
      const res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        // a policy decline (a security-themed commit, say) is answered by the fallback model instead
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: {
          effort: "medium",
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: { summary: { type: "string" } },
              required: ["summary"],
              additionalProperties: false,
            },
          },
        },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: JSON.stringify(await request(d, m)) }],
      });
      if (res.stop_reason !== "end_turn") throw new Error(`stopped: ${res.stop_reason}`);
      const text = JSON.parse(res.content.find((b) => b.type === "text").text).summary.trim();
      if (!text || text.length > 300) throw new Error(`unusable summary (${text.length} characters)`);
      summaries[d] = { hash: hash(m), text };
      console.log(`${d} summarised: ${res.usage.input_tokens} in, ${res.usage.output_tokens} out`);
    } catch (e) {
      console.error(`${d} not summarised:`, e.message);
      // a day that changed keeps its last summary until the next one can be written
      if (cache[d]) summaries[d] = cache[d];
    }
  }
} else for (const [d] of pending) if (cache[d]) summaries[d] = cache[d];
for (const e of journal) if (summaries[e.day]) e.text = summaries[e.day].text;
if (!DRY && JSON.stringify(summaries) !== JSON.stringify(cache))
  writeFileSync(SUMMARIES, `${JSON.stringify(summaries, null, 1)}\n`);

const next = {
  days,
  repos,
  totals: { commits: commitsAll, merged: mergedAll, releases: releasesAll, people: people.size },
  journal,
};
const strip = ({ updatedAt, ...rest }) => rest;
if (JSON.stringify(strip(prev)) === JSON.stringify(next)) console.log("activity unchanged");
else {
  writeFileSync(FILE, `${JSON.stringify({ ...next, updatedAt: now.toISOString() })}\n`);
  console.log("activity updated", next.totals, `${journal.length} days in the journal`);
}

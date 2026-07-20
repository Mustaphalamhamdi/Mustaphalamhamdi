// Renders assets/stats.svg from the GitHub API.
// Self-hosted on purpose: the public github-readme-stats instance is
// permanently paused (503 DEPLOYMENT_PAUSED), and anything proxied through
// camo from a third party can die the same way. This asset is served from
// raw.githubusercontent alongside the hero banner and the chess board.
//
// Every element renders at full opacity with no animation — GitHub shows
// README SVGs as a static frame, so nothing may depend on motion to be legible.

const fs = require("fs");
const path = require("path");

const USER = "Mustaphalamhamdi";
const OUT = path.join(__dirname, "..", "assets", "stats.svg");
const TOKEN = process.env.GITHUB_TOKEN || "";

// palette — shared with hero-banner.svg and the chess board
const C = {
  bg: "#101012",
  frame: "#2e2e33",
  value: "#f4f4f2",
  label: "#6b6b70",
  track: "#27272a",
  muted: "#52525b",
};
const ACCENTS = ["#f97316", "#eab308", "#22d3ee", "#f43f5e", "#a3e635"];

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function api(url) {
  const headers = { "User-Agent": USER, Accept: "application/vnd.github+json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// Contribution count needs GraphQL. It's a nice-to-have: if the token can't
// reach it, we drop the tile rather than fail the render.
async function contributions() {
  if (!TOKEN) return null;
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "User-Agent": USER,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions}}}}`,
        variables: { login: USER },
      }),
    });
    const json = await res.json();
    const n =
      json?.data?.user?.contributionsCollection?.contributionCalendar
        ?.totalContributions;
    return typeof n === "number" ? n : null;
  } catch (e) {
    return null;
  }
}

async function collect() {
  const user = await api(`https://api.github.com/users/${USER}`);
  const repos = await api(
    `https://api.github.com/users/${USER}/repos?per_page=100&type=owner`
  );

  const stars = repos.reduce((a, r) => a + r.stargazers_count, 0);
  const forks = repos.reduce((a, r) => a + r.forks_count, 0);

  // Language share, averaged per repo rather than summed by raw bytes.
  // Summing bytes lets one repo with vendored/bundled dependencies (48 MB of
  // library JavaScript in a single project) drown out every other language.
  // Normalising inside each repo first gives every project an equal voice,
  // which describes what actually gets built here.
  const shares = {};
  let counted = 0;
  for (const r of repos) {
    if (r.fork) continue;
    let langs;
    try {
      langs = await api(r.languages_url);
    } catch (e) {
      continue; // a single unreadable repo shouldn't sink the whole render
    }
    const repoTotal = Object.values(langs).reduce((a, b) => a + b, 0);
    if (!repoTotal) continue;
    counted++;
    for (const [name, n] of Object.entries(langs)) {
      shares[name] = (shares[name] || 0) + n / repoTotal;
    }
  }

  const langs = Object.entries(shares)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, s]) => ({ name, pct: (s / Math.max(counted, 1)) * 100 }));

  return {
    repos: user.public_repos,
    stars,
    forks,
    followers: user.followers,
    contributions: await contributions(),
    langs,
  };
}

function render(d) {
  const W = 900;
  const PAD = 34;
  const barsTop = 132;
  const rowH = 26;
  const H = barsTop + d.langs.length * rowH + 26;

  const tiles = [
    d.contributions != null && { v: d.contributions, l: "CONTRIBUTIONS" },
    { v: d.repos, l: "REPOSITORIES" },
    { v: d.stars, l: "STARS" },
    { v: d.forks, l: "FORKS" },
  ].filter(Boolean);

  const o = [];
  o.push(
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`
  );
  o.push(`<rect width="${W}" height="${H}" rx="10" fill="${C.bg}"/>`);
  o.push(
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="10" fill="none" stroke="${C.frame}" stroke-width="1"/>`
  );

  const sans = `'Segoe UI','Helvetica Neue',Arial,sans-serif`;
  const mono = `'Courier New',monospace`;

  // stat tiles — fixed column width so they read as a group instead of
  // drifting apart when a tile is missing
  const colW = 168;
  tiles.forEach((t, i) => {
    const x = PAD + i * colW;
    o.push(
      `<text x="${x}" y="72" font-family="${sans}" font-size="40" font-weight="700" letter-spacing="-1" fill="${C.value}">${esc(t.v)}</text>`
    );
    o.push(
      `<text x="${x}" y="94" font-family="${sans}" font-size="10.5" letter-spacing="2.4" fill="${C.label}">${esc(t.l)}</text>`
    );
  });

  o.push(
    `<line x1="${PAD}" y1="112" x2="${W - PAD}" y2="112" stroke="${C.frame}" stroke-width="1"/>`
  );

  // language bars
  const labelW = 108;
  const barX = PAD + labelW;
  const barW = W - PAD * 2 - labelW - 62;

  d.langs.forEach((l, i) => {
    const y = barsTop + i * rowH;
    const fill = ACCENTS[i % ACCENTS.length];
    const w = Math.max(2, (l.pct / 100) * barW);
    o.push(
      `<text x="${PAD}" y="${y + 11}" font-family="${sans}" font-size="12.5" fill="${C.label}">${esc(l.name)}</text>`
    );
    o.push(
      `<rect x="${barX}" y="${y + 2}" width="${barW}" height="10" rx="5" fill="${C.track}"/>`
    );
    o.push(
      `<rect x="${barX}" y="${y + 2}" width="${w.toFixed(1)}" height="10" rx="5" fill="${fill}"/>`
    );
    o.push(
      `<text x="${W - PAD}" y="${y + 11}" text-anchor="end" font-family="${mono}" font-size="11.5" fill="${C.muted}">${l.pct.toFixed(1)}%</text>`
    );
  });

  o.push("</svg>");
  return o.join("\n") + "\n";
}

collect()
  .then((d) => {
    fs.writeFileSync(OUT, render(d));
    console.log("wrote", OUT);
    console.log(
      `repos=${d.repos} stars=${d.stars} forks=${d.forks} contributions=${d.contributions ?? "n/a"}`
    );
    console.log("languages:", d.langs.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(", "));
  })
  .catch((e) => {
    console.error("stats render failed:", e.message);
    process.exit(1);
  });

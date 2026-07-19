// Community chess for the profile README.
// Reads the triggering issue from env vars, applies the move,
// re-renders the board SVG and the README section, and writes
// a reply comment to /tmp/chess-comment.txt for the workflow to post.

const fs = require("fs");
const path = require("path");
const { Chess } = require("chess.js");

const REPO = "Mustaphalamhamdi/Mustaphalamhamdi";
const BRANCH = "main"; // change to "master" if that's your default branch
const ROOT = path.join(__dirname, "..");
const STATE_FILE = path.join(ROOT, "games/chess/state.json");
const BOARD_FILE = path.join(ROOT, "games/chess/board.svg");
const README_FILE = path.join(ROOT, "README.md");
const COMMENT_FILE = "/tmp/chess-comment.txt";

const START_MARK = "<!-- CHESS-START -->";
const END_MARK = "<!-- CHESS-END -->";

// ---------- palette (neo-minimal / micro-maximal) ----------
const C = {
  bg: "#101012",
  light: "#232328",
  dark: "#1a1a1e",
  whitePiece: "#f4f4f2",
  blackPiece: "#f97316",
  coord: "#52525b",
  lastMove: "#eab308",
  check: "#f43f5e",
  frame: "#2e2e33",
};

const GLYPH = { p: "\u265F", r: "\u265C", n: "\u265E", b: "\u265D", q: "\u265B", k: "\u265A" };
const WHITE_GLYPH = { p: "\u2659", r: "\u2656", n: "\u2658", b: "\u2657", q: "\u2655", k: "\u2654" };

function loadState() {
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}
function saveState(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + "\n");
}
function writeComment(text) {
  fs.writeFileSync(COMMENT_FILE, text);
}

// ---------- board rendering ----------
function renderBoard(game, state) {
  const sq = 44;
  const m = 26; // margin for coordinates
  const size = sq * 8 + m * 2;
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  let out = [];
  out.push(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`
  );
  out.push(`<rect width="${size}" height="${size}" rx="10" fill="${C.bg}"/>`);
  out.push(
    `<rect x="${m - 2}" y="${m - 2}" width="${sq * 8 + 4}" height="${sq * 8 + 4}" fill="none" stroke="${C.frame}" stroke-width="1.5" rx="4"/>`
  );

  const last = state.lastMove; // { from, to } or null
  const board = game.board(); // ranks 8 -> 1
  const inCheck = game.inCheck();
  const turn = game.turn();

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const x = m + f * sq;
      const y = m + r * sq;
      const square = files[f] + (8 - r);
      const isLight = (r + f) % 2 === 0;
      let fill = isLight ? C.light : C.dark;
      out.push(`<rect x="${x}" y="${y}" width="${sq}" height="${sq}" fill="${fill}"/>`);

      if (last && (square === last.from || square === last.to)) {
        out.push(
          `<rect x="${x + 1.5}" y="${y + 1.5}" width="${sq - 3}" height="${sq - 3}" fill="none" stroke="${C.lastMove}" stroke-width="2"/>`
        );
      }

      const piece = board[r][f];
      if (piece) {
        if (inCheck && piece.type === "k" && piece.color === turn) {
          out.push(
            `<rect x="${x + 1.5}" y="${y + 1.5}" width="${sq - 3}" height="${sq - 3}" fill="none" stroke="${C.check}" stroke-width="2"/>`
          );
        }
        const color = piece.color === "w" ? C.whitePiece : C.blackPiece;
        const glyph = piece.color === "w" ? GLYPH[piece.type] : GLYPH[piece.type];
        out.push(
          `<text x="${x + sq / 2}" y="${y + sq / 2 + 11}" text-anchor="middle" font-size="32" fill="${color}" font-family="'Segoe UI Symbol','Noto Sans Symbols 2','Apple Symbols',sans-serif">${glyph}</text>`
        );
      }
    }
  }

  // coordinates
  for (let f = 0; f < 8; f++) {
    out.push(
      `<text x="${m + f * sq + sq / 2}" y="${size - 8}" text-anchor="middle" font-size="11" fill="${C.coord}" font-family="Arial,sans-serif">${files[f]}</text>`
    );
  }
  for (let r = 0; r < 8; r++) {
    out.push(
      `<text x="${m - 12}" y="${m + r * sq + sq / 2 + 4}" text-anchor="middle" font-size="11" fill="${C.coord}" font-family="Arial,sans-serif">${8 - r}</text>`
    );
  }
  out.push("</svg>");
  fs.writeFileSync(BOARD_FILE, out.join("\n") + "\n");
}

// ---------- README section ----------
function moveLink(uci, san) {
  const title = encodeURIComponent(`chess|move|${uci}`);
  const body = encodeURIComponent(
    "Just press 'Create' below — the bot plays your move within ~30 seconds. Then go back to the profile and refresh!"
  );
  const url = `https://github.com/${REPO}/issues/new?title=${title}&body=${body}`;
  return `[${san}](${url})`;
}

function buildSection(game, state) {
  const ts = Date.now();
  const boardUrl = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/games/chess/board.svg?t=${ts}`;
  const turnName = game.turn() === "w" ? "White \u2659" : "Black \u265F";
  const lines = [];

  lines.push(START_MARK);
  lines.push("");
  lines.push("<div align=\"center\">");
  lines.push("");
  lines.push(`<img src="${boardUrl}" alt="Community chess board" width="420"/>`);
  lines.push("");
  lines.push("</div>");
  lines.push("");
  lines.push(
    `**It's ${turnName} to move.** Anyone can play — pick a move below, an issue opens pre-filled, press *Create*, wait ~30s, refresh this page. Your move is on the board and your name is in the hall of fame.`
  );
  lines.push("");

  // legal moves grouped by origin square
  const verbose = game.moves({ verbose: true });
  const groups = {};
  for (const mv of verbose) {
    const g = game.get(mv.from);
    const glyph = g.color === "w" ? WHITE_GLYPH[g.type] : GLYPH[g.type];
    const key = `${glyph} ${mv.from}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(moveLink(mv.from + mv.to + (mv.promotion || ""), mv.san));
  }
  lines.push("| Piece | Available moves |");
  lines.push("|:---:|:---|");
  for (const key of Object.keys(groups)) {
    lines.push(`| ${key} | ${groups[key].join(" \u00b7 ")} |`);
  }
  lines.push("");

  // recent moves
  if (state.history.length > 0) {
    lines.push("**Recent moves**");
    lines.push("");
    const recent = state.history.slice(-5).reverse();
    for (const h of recent) {
      lines.push(`- \`${h.san}\` by [@${h.player}](https://github.com/${h.player})`);
    }
    lines.push("");
  }

  // hall of fame
  const entries = Object.entries(state.players).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (entries.length > 0) {
    lines.push("**Hall of fame** (most moves played)");
    lines.push("");
    entries.forEach(([name, count], i) => {
      const medal = ["\u{1F947}", "\u{1F948}", "\u{1F949}", "\u2726", "\u2726"][i];
      lines.push(`${medal} [@${name}](https://github.com/${name}) — ${count} move${count > 1 ? "s" : ""}`);
    });
    lines.push("");
  }

  lines.push(
    `*Games completed on this board: ${state.gamesPlayed}. Powered by GitHub issues + Actions — no server, no magic, just \u265F.*`
  );
  lines.push("");
  lines.push(END_MARK);
  return lines.join("\n");
}

function updateReadme(section) {
  let readme = fs.existsSync(README_FILE) ? fs.readFileSync(README_FILE, "utf8") : "";
  const start = readme.indexOf(START_MARK);
  const end = readme.indexOf(END_MARK);
  if (start !== -1 && end !== -1) {
    readme = readme.slice(0, start) + section + readme.slice(end + END_MARK.length);
  } else {
    readme = readme.trimEnd() + "\n\n## \u265F\uFE0F Play chess on my profile\n\n" + section + "\n";
  }
  fs.writeFileSync(README_FILE, readme);
}

// ---------- main ----------
function main() {
  const title = (process.env.ISSUE_TITLE || "chess|init").trim();
  const author = (process.env.ISSUE_AUTHOR || "").trim();
  const parts = title.split("|").map((p) => p.trim());

  const state = loadState();
  const game = new Chess(state.fen);

  if (parts[0] !== "chess") {
    writeComment("This doesn't look like a chess command, so I'll sit this one out. \u265F");
    process.exit(0);
  }

  const action = parts[1] || "init";

  if (action === "move") {
    const uci = (parts[2] || "").toLowerCase();
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
      writeComment(
        `Hmm, \`${parts[2] || "?"}\` isn't a move I understand. Please use the move links on my profile — they're always legal. \u265F`
      );
      renderBoard(game, state);
      updateReadme(buildSection(game, state));
      process.exit(0);
    }
    const moveObj = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
    if (uci.length === 5) moveObj.promotion = uci[4];

    let played;
    try {
      played = game.move(moveObj);
    } catch (e) {
      played = null;
    }

    if (!played) {
      writeComment(
        `\u26A0\uFE0F \`${uci}\` isn't legal in the current position — someone probably moved just before you! Head back to [the board](https://github.com/${REPO}) and pick from the fresh move list. \u265F`
      );
      renderBoard(game, state);
      updateReadme(buildSection(game, state));
      process.exit(0);
    }

    // record the move
    state.lastMove = { from: played.from, to: played.to };
    state.history.push({ san: played.san, player: author || "anonymous" });
    if (author) state.players[author] = (state.players[author] || 0) + 1;

    let reply = `\u2705 **${played.san}** — beautifully played, @${author}! `;

    if (game.isGameOver()) {
      let result;
      if (game.isCheckmate()) {
        const winner = game.turn() === "w" ? "Black \u265F" : "White \u2659";
        result = `**Checkmate — ${winner} wins!** \u{1F3C6}`;
      } else if (game.isStalemate()) {
        result = "**Stalemate — it's a draw!**";
      } else {
        result = "**The game is a draw!**";
      }
      state.gamesPlayed += 1;
      state.fen = new Chess().fen();
      state.lastMove = null;
      state.history = [];
      const fresh = new Chess();
      renderBoard(fresh, state);
      updateReadme(buildSection(fresh, state));
      saveState(state);
      writeComment(
        reply +
          `\n\n${result}\n\nA brand-new game has just started on [my profile](https://github.com/${REPO}) — first move takes the honor. \u265F`
      );
      return;
    }

    if (game.inCheck()) reply += "And that's **check**! \u{1F525} ";
    state.fen = game.fen();
    renderBoard(game, state);
    updateReadme(buildSection(game, state));
    saveState(state);
    writeComment(
      reply +
        `\n\nThe board is updated — [see it live](https://github.com/${REPO}). It's ${game.turn() === "w" ? "White" : "Black"}'s turn now. Tell a friend \u265F`
    );
    return;
  }

  // init / re-render
  renderBoard(game, state);
  updateReadme(buildSection(game, state));
  saveState(state);
  writeComment("Board rendered. \u265F");
}

main();

# Community Chess — Setup

## 1. Upload these files to your Mustaphalamhamdi repo (keep the structure):
- package.json            → repo root
- .gitignore              → repo root (merge with existing if you have one)
- scripts/chess.js        → scripts folder
- games/chess/state.json  → games/chess folder
- games/chess/board.svg   → games/chess folder
- .github/workflows/chess.yml → workflows folder

## 2. Add the game section to your README.md
Paste these two lines wherever you want the game to appear:

## ♟️ Play chess on my profile

<!-- CHESS-START -->
<!-- CHESS-END -->

The bot fills everything between the markers automatically.

## 3. First render
Actions tab → "Community Chess" → Run workflow.
After the green check, your README shows the live board and move links.

## 4. Play a move yourself to test it
Click any move link on your profile → press "Create" on the issue →
wait ~30 seconds → refresh your profile. The board moved, the issue
got a reply from the bot and closed itself.

## Notes
- Default branch must be "main". If yours is "master": change
  BRANCH in scripts/chess.js (line 12) and ref in chess.yml.
- Keep "Read and write permissions" enabled
  (Settings → Actions → General → Workflow permissions).
- Games auto-restart after checkmate/draw, and every player's
  move count goes into the Hall of Fame forever.

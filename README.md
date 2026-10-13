# Nosh Dish Dashboard

A small full-stack app to view dishes, edit their name and published status, and
safely handle two people editing the same dish (optimistic locking with a version number).

- Frontend: React (Vite) + plain CSS
- Backend: Node.js + Express
- Database: SQLite via `better-sqlite3`

## Prerequisites
- Node.js 18 or newer and npm

## Quick start (root scripts)

```bash
npm install            # installs concurrently (root)
npm run install:all    # installs backend + frontend dependencies
npm run seed           # creates the DB and adds the 5 dishes (safe to repeat)
npm run dev            # backend on :4000 and frontend on :5173 together
```

Open http://localhost:5173. The `.env` files are optional because both apps fall back to the
same defaults; to customise, copy `backend/.env.example` and `frontend/.env.example` to `.env`.

## Alternative: per-folder setup

```bash
# Backend (terminal 1)
cd backend
npm install
npm run seed          # safe to run many times (INSERT OR IGNORE)
npm start             # http://localhost:4000

# Frontend (terminal 2)
cd frontend
npm install
npm run dev           # http://localhost:5173
```

Extra: `npm run seed:test` (in `backend`) adds one more dish, `test-1`, with an invalid image URL.

### Environment examples
`backend/.env.example`
```
PORT=4000
DB_PATH=./data/dishes.db
```
`frontend/.env.example`
```
VITE_API_URL=http://localhost:4000
```

## API examples

```bash
H='Content-Type: application/json'

# List dishes
curl -s localhost:4000/dishes

# Update a dish (all three fields are required)
curl -s -X PATCH localhost:4000/dishes/1 -H "$H" \
  -d '{"dishName":"Paneer Curry","isPublished":true,"expectedVersion":1}'
```

| Status | When | Body |
|---|---|---|
| 200 | Update succeeded | the updated dish |
| 400 | Bad body, empty name or invalid image URL when publishing | `{error:"VALIDATION_ERROR", message}` |
| 404 | Unknown dishId | `{error:"NOT_FOUND", message}` |
| 409 | `expectedVersion` is stale | `{error:"VERSION_CONFLICT", message, currentDish}` |
| 500 | Unexpected error | `{error:"SERVER_ERROR", message}` |

Dish JSON: `{ dishId, dishName, imageUrl, isPublished, version }`.

## Architecture

- `backend/src/db.js` opens SQLite and creates the `dishes` table.
- `routes/dishes.js` only maps HTTP to the service; `services/dishService.js` holds
  validation and the update. `server.js` has one error handler so every error has the same JSON shape.
- PATCH checks in order: body validation, dish lookup, publish rules, then an atomic update.
- Frontend: `App.jsx` holds the **saved** dishes and polls every 5 seconds.
  Each `DishCard` holds its own **draft** (`dishName`, `isPublished`) and `baseVersion`.
  Nothing is sent to the server until Save.

## Design decision: optimistic locking in SQL

The update is one statement:
`UPDATE dishes SET ..., version = version + 1 WHERE dish_id = ? AND version = ?`.
The database checks the version and writes in a single step, so two simultaneous saves
cannot both succeed. Reading the version, comparing in JavaScript and then updating would leave
a gap between the read and the write. If 0 rows change, the server returns 409 with the current
dish, and the UI never auto-retries: the user chooses whether to discard their draft.

The "name must not be empty" rule applies only when publishing (`isPublished: true`), as the
assignment words it. An unpublished draft dish may have an empty name.

## Verification steps

Start both servers and run `npm run seed` and `npm run seed:test` (in `backend`) first.
Backend steps use curl; UI steps were checked manually in the browser.

1. **Seeding is idempotent** (verified): run `npm run seed` twice. Second run prints `added 0, skipped 5`.
2. **Draft and save** (verified): edit a name. "Unsaved changes" and a highlight appear. Save: the badge goes away and version increases by 1. Discard restores saved values.
3. **Two-tab conflict** (verified): open the app in two tabs. In tab B type a change in dish 1 (don't save yet). Save dish 1 in tab A. Now Save in tab B: you see "Someone else updated this dish." and your draft stays. "Reload latest" asks for confirmation, then shows tab A's values. (A tab with no unsaved edits is updated by polling within 5 seconds, so type in tab B *before* saving in tab A.)
4. **Backend down** (verified): stop the backend. Within ~5 seconds the "Connection lost, retrying…" banner appears and the cards stay. Saving shows "Cannot reach the server" and keeps the draft. Restart the backend: the banner disappears. Loading the page with the backend down shows an error with a Retry button.
5. **Invalid image URL** (verified): after `npm run seed:test`, tick Published on "Test Dish" (`test-1`) and Save. The server rejects it with a 400 message and the draft stays. Unticked, saving a new name works. Same via curl:
   `curl -s -X PATCH localhost:4000/dishes/test-1 -H 'Content-Type: application/json' -d '{"dishName":"T","isPublished":true,"expectedVersion":1}'`
6. **Validation / 404** (verified with curl): `"isPublished":"true"` gives 400, an empty name with `isPublished:true` gives 400, dish `999` gives 404.
7. **Polling** (verified): PATCH a dish with curl. A card with no unsaved edits updates within 5 seconds. A card with unsaved edits keeps its draft and shows "A newer version is available. Save will conflict; reload to see it."
8. **Broken-image placeholder** (verified): `test-1` has the invalid image URL `not-a-valid-url`, so its card shows the "No image" placeholder instead of a broken image icon.
9. **Edits don't touch the database before Save** (verified): type a new name in a card without saving, then run `curl -s localhost:4000/dishes`. The name and version are unchanged. Click Discard: the old name returns in the card.
10. **Persistence across refresh and restart** (verified): Save a change, refresh the page (the new name and version stay), then stop and restart the backend and refresh. The saved name and version are still there, because they live in the SQLite file `backend/data/dishes.db`.
11. **Reseeding keeps edits** (verified): after saving a change, run `npm run seed` again. It prints `added 0, skipped 5`, and the edited dish keeps its new name and version.
12. **Concurrency test** (verified): 10 parallel PATCHes with `expectedVersion` 1 on a freshly seeded DB gave **one 200 and nine 409s**, and the final version was 2. To rerun it (backend running, fresh DB):
   ```bash
   for i in $(seq 1 10); do
     curl -s -o /dev/null -w '%{http_code}\n' -X PATCH localhost:4000/dishes/4 \
       -H 'Content-Type: application/json' \
       -d "{\"dishName\":\"R$i\",\"isPublished\":true,\"expectedVersion\":1}" &
   done | sort | uniq -c; wait
   curl -s localhost:4000/dishes | grep -o '"dishId":"4"[^}]*'    # ends with "version":2
   ```

## Real-time updates (bonus)

- **Delay:** `App.jsx` polls `GET /dishes` every 5 seconds, so changes made elsewhere appear within about 5 seconds.
- **Cleanup:** the `setInterval` is stopped with `clearInterval` in the `useEffect` cleanup when the component unmounts.
- **Disconnects:** if a poll fails, a "Connection lost, retrying…" banner shows, the old data stays on screen, and polling keeps retrying every 5 seconds. The banner hides on the next success (which also clears a failed initial-load error).
- **Stale responses:** a poll that started before a save can finish after it. When applying poll results (and saves), the app never replaces a dish with a lower version.
- **Drafts:** a card with no unsaved edits follows the new server values. A card with unsaved edits keeps its draft and `baseVersion` and shows a notice, so a later Save gets a 409 instead of silently overwriting.

## Known limitations
- No authentication, and no way to create or delete dishes.
- Only the name and published status are editable; `imageUrl` is not.
- Polling refreshes the whole list every 5 seconds (no websockets).
- The "Unsaved changes" badge can disappear if someone else saves the same content you typed. The badge compares content, while the server compares versions, so nothing is lost: saving would still be version-checked.
- No automated tests; verification is manual (steps above).
- `better-sqlite3` is pinned to v11 because v13 requires Node 22.

## Time spent
About 2.5 hours.

## AI use disclosure
This project was built with the help of Claude Code (an AI coding assistant) in stages: I gave the
requirements and design, and the assistant wrote the code, which I reviewed and tested.

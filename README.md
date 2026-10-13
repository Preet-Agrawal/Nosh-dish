# Nosh Dish Dashboard

A small full-stack app to view dishes, edit their name and published status, and
safely handle two people editing the same dish (optimistic locking with a version number).

- Frontend: React (Vite) + plain CSS
- Backend: Node.js + Express
- Database: SQLite via `better-sqlite3`

## Prerequisites
- Node.js 18 or newer and npm

## Setup and run

```bash
# Backend (terminal 1)
cd backend
npm install
cp .env.example .env
npm run seed          # safe to run many times (INSERT OR IGNORE)
npm start             # http://localhost:4000

# Frontend (terminal 2)
cd frontend
npm install
cp .env.example .env
npm run dev           # http://localhost:5173
```

Other commands: `npm run seed:test` (backend) adds one extra dish, `test-1`, with an invalid image URL.

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

## Verification steps

Start both servers and run `npm run seed` and `npm run seed:test` first.

1. **Seeding is idempotent:** run `npm run seed` twice. Second run prints `added 0, skipped 5`.
2. **Draft and save:** edit a name. "Unsaved changes" and a highlight appear. Save: the badge goes away and version increases by 1. Discard restores saved values.
3. **Two-tab conflict:** open the app in two tabs. Save dish 1 in tab A. In tab B (not refreshed, or within 5s before polling updates it) edit dish 1 and Save: you see "Someone else updated this dish." and your draft stays. "Reload latest" asks for confirmation, then shows tab A's values. (Polling will usually update tab B within 5 seconds if it has no unsaved edits, so type a change in tab B *before* saving in tab A to see the conflict. You will also see the "newer version" notice.)
4. **Backend down:** stop the backend. Within ~5 seconds the "Connection lost, retrying…" banner appears and the cards stay. Saving shows "Cannot reach the server" and keeps the draft. Restart the backend: the banner disappears. Loading the page with the backend down shows an error with a Retry button.
5. **Invalid image URL:** after `npm run seed:test`, find "Test Dish" (`test-1`), tick Published and Save. The server rejects it with a 400 message and the draft stays. Unticked, saving a new name works. Same via curl:
   `curl -s -X PATCH localhost:4000/dishes/test-1 -H "$H" -d '{"dishName":"T","isPublished":true,"expectedVersion":1}'`
6. **Validation / 404:** use the curl examples above with `"isPublished":"true"` (400), an empty name with `isPublished:true` (400) and dish `999` (404).
7. **Polling:** PATCH a dish with curl. A card with no unsaved edits updates within 5 seconds. A card with unsaved edits keeps its draft and shows "A newer version is available. Save will conflict; reload to see it."
8. **Broken image:** the seed image URLs may not load; those cards show a "No image" placeholder.

## Known limitations
- No authentication, and no way to create or delete dishes.
- Only the name and published status are editable; `imageUrl` is not.
- Polling refreshes the whole list every 5 seconds (no websockets).
- If the server's copy changes to equal the user's draft, the "Unsaved changes" badge disappears even though the version differs; saving again would still be checked by the server.
- No automated tests; verification is manual (steps above).
- `better-sqlite3` is pinned to v11 because v13 requires Node 22.

## Time spent
TODO: about 2.5 hours.

## AI use disclosure
This project was built with the help of Claude Code (an AI coding assistant) in stages: I gave the
requirements and design, and the assistant wrote the code, which I reviewed and tested.

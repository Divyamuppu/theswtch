# thswtch Social HQ — Firebase (no login)

A live social dashboard for **thswtch**, built on **Next.js + Firebase** (Firestore).

- **No sign-in.** Anyone who opens the link can view and edit the board.
- On first open, each person **types their name** once (remembered on that device) so the **per-tab chat** shows who said what.
- Everyone sees changes **in real time** (Firestore).

Under the hood it uses Firebase **Anonymous Auth** — each browser gets an invisible identity automatically (no email, no password). Security rules allow any of those visitors to read/edit the board and to post/delete their own chat messages.

> Anyone with the link can edit. If you need view-only clients or restricted editing later, that's a rules change — just ask.

---

## Setup (about 10 minutes)

### 1. Firebase project
[console.firebase.google.com](https://console.firebase.google.com) → create a project (free **Spark** plan is fine). Add a **Web app** and copy its config.

### 2. Enable Anonymous sign-in
**Authentication → Get started → Sign-in method → Add new provider → Anonymous → Enable.**
(That's the only provider you need — ignore Email/Password.)

### 3. Firestore + rules
**Firestore Database → Create database** → Production mode → region `asia-south1`.
Then **Rules** tab → paste the contents of [`firestore.rules`](./firestore.rules) → **Publish**.

### 4. Config → `.env.local`
Copy `.env.local.example` to **`.env.local`** (exact name, in the project root) and paste your six values. **Copy the `apiKey` directly from the Firebase config** — don't retype it:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=theswtch-3e1aa.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=theswtch-3e1aa
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=theswtch-3e1aa.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=172022275187
NEXT_PUBLIC_FIREBASE_APP_ID=1:172022275187:web:...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 5. Run
```bash
npm install
npm run dev
```
Open **http://localhost:3000** → type your name → you're in the dashboard, able to edit everything.

> The board starts empty — just add goals/links and they save live. Want sample starter content? Run `npm run seed` (needs a service-account key; see `scripts/seed.mjs`). Optional.

---

## Deploy to Vercel (so others can use the link)

1. Push this folder to GitHub → import in [Vercel](https://vercel.com).
2. Add the `NEXT_PUBLIC_FIREBASE_*` vars, and set `NEXT_PUBLIC_SITE_URL` to your Vercel URL.
3. Deploy, then in Firebase → **Authentication → Settings → Authorized domains**, add your Vercel domain.

Share that URL — anyone who opens it can use the dashboard.

## Project structure

```
firestore.rules             Security rules (any visitor edits; owns their chat)
src/lib/firebase.ts         Firebase init
src/app/dashboard/page.tsx  Anonymous sign-in + renders the dashboard
src/components/Dashboard.tsx The live dashboard (realtime CRUD, chat, name prompt)
src/app/globals.css         Styling (light + dark)
scripts/seed.mjs            Optional starter content (Admin SDK)
```

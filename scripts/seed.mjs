// Seeds your team allowlist + starter board content.
//
// 1. Firebase console → Project settings → Service accounts → "Generate new
//    private key". Save the file as serviceAccountKey.json in this folder.
//    (It is gitignored — never commit it.)
// 2. Edit TEAM_EMAILS below.
// 3. Run:  npm run seed
//
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

const serviceAccount = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  const batch = db.batch();

  // Settings
  batch.set(
    db.collection("settings").doc("main"),
    {
      weekLabel: "Week of Oct 5 – 11",
      notes:
        "Focus this week: tease the new flavour drop and push Reels reach. Keep every CTA consistent across posts.",
      socialsCalendarLabel: "Content Calendar (Excel)",
      socialsCalendarUrl: "",
    },
    { merge: true }
  );

  // Quick links (doc id = key)
  const quick = [
    ["calendar", "Brand Calendar (Excel)"],
    ["website", "Website"],
    ["performance", "Performance"],
    ["report", "Performance Report"],
  ];
  for (const [key, label] of quick) {
    batch.set(
      db.collection("quickLinks").doc(key),
      { key, label, url: "" },
      { merge: true }
    );
  }

  // Starter tasks
  const tasks = [
    ["weekly", "Lock 3 Reel concepts for the week", false, 1],
    ["weekly", "Write captions + hashtag sets", true, 2],
    ["weekly", "Schedule Mon / Wed / Fri posts", false, 3],
    ["weekly", "Reply to comments & DMs daily", false, 4],
    ["socials", "Confirm this week's grid order", false, 1],
    ["socials", "Approve captions with client", false, 2],
    ["website", "Refresh homepage hero banner", false, 1],
    ["website", "Publish new blog post", false, 2],
    ["website", "Check all product links work", false, 3],
    ["performance", "Review last week's Reel reach", false, 1],
    ["performance", "Note top 3 performing posts", false, 2],
    ["performance", "Adjust posting times if needed", false, 3],
  ];
  for (const [tab, body, done, position] of tasks) {
    const ref = db.collection("tasks").doc();
    batch.set(ref, {
      tab,
      body,
      done,
      url: "",
      position,
      createdAt: Date.now(),
      createdBy: null,
    });
  }

  await batch.commit();
  console.log(
    `Seeded: settings, 4 quick links, ${tasks.length} tasks.`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

if (process.env.DATABASE_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL or DATABASE_PUBLIC_URL is required");
}

const { readStore, updateStore } = await import("../backend/src/db/store.js");

await updateStore(() => {});

const store = await readStore();
const sessions = store.sessions || [];

console.log(
  JSON.stringify({
    sessions: sessions.length,
    plaintextTokens: sessions.filter((session) => Boolean(session.token)).length,
    hashedTokens: sessions.filter((session) => Boolean(session.tokenHash)).length,
  }),
);

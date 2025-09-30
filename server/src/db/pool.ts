import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = process.env.STATLITE_DATA || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'statlite.sqlite');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_FILE, { verbose: undefined });
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// lightweight async queue for writes (reduces lock contention)
type Job = () => void;
const writeQueue: Job[] = [];
let flushing = false;

export function enqueueWrite(job: Job) {
  writeQueue.push(job);
  if (!flushing) flushQueue();
}

async function flushQueue() {
  flushing = true;
  try {
    while (writeQueue.length) {
      const batch = writeQueue.splice(0, 64);
      db.transaction(() => {
        for (const j of batch) j();
      })();
      await new Promise(r => setImmediate(r));
    }
  } finally {
    flushing = false;
  }
}



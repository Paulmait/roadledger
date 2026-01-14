import * as SQLite from 'expo-sqlite';

const DB_NAME = 'roadledger.db';

let db: SQLite.SQLiteDatabase | null = null;

// Initialize and get database instance
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync(DB_NAME);
  await initializeSchema(db);
  return db;
}

// Initialize the database schema
async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    -- Enable foreign keys
    PRAGMA foreign_keys = ON;

    -- Sync queue for tracking pending operations
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
      record_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      synced_at TEXT
    );

    -- Local trips table
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      started_at TEXT NOT NULL,
      ended_at TEXT,
      loaded INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      auto_miles_total REAL,
      manual_miles_total REAL,
      source TEXT NOT NULL DEFAULT 'gps',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      pending_sync INTEGER NOT NULL DEFAULT 1
    );

    -- Local trip points table
    CREATE TABLE IF NOT EXISTS trip_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      ts TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      speed REAL,
      accuracy_m REAL,
      jurisdiction TEXT,
      synced_at TEXT,
      pending_sync INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    -- Local jurisdiction miles table
    CREATE TABLE IF NOT EXISTS jurisdiction_miles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      miles REAL NOT NULL DEFAULT 0,
      confidence REAL,
      method TEXT NOT NULL DEFAULT 'gps',
      synced_at TEXT,
      pending_sync INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      UNIQUE(trip_id, jurisdiction)
    );

    -- Local documents table (metadata only, files stored via expo-file-system)
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      trip_id TEXT,
      type TEXT NOT NULL,
      local_path TEXT,
      storage_path TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      parsed_status TEXT NOT NULL DEFAULT 'pending',
      vendor TEXT,
      document_date TEXT,
      total_amount REAL,
      currency TEXT DEFAULT 'USD',
      extraction_json TEXT,
      synced_at TEXT,
      pending_sync INTEGER NOT NULL DEFAULT 1
    );

    -- Local transactions table
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      trip_id TEXT,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      vendor TEXT,
      description TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      document_id TEXT,
      gallons REAL,
      jurisdiction TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      pending_sync INTEGER NOT NULL DEFAULT 1
    );

    -- Sync metadata table
    CREATE TABLE IF NOT EXISTS sync_metadata (
      table_name TEXT PRIMARY KEY,
      last_synced_at TEXT,
      last_pull_at TEXT
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_trips_user_status ON trips(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_trips_pending ON trips(pending_sync) WHERE pending_sync = 1;
    CREATE INDEX IF NOT EXISTS idx_trip_points_trip ON trip_points(trip_id, ts);
    CREATE INDEX IF NOT EXISTS idx_trip_points_pending ON trip_points(pending_sync) WHERE pending_sync = 1;
    CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, uploaded_at);
    CREATE INDEX IF NOT EXISTS idx_documents_pending ON documents(pending_sync) WHERE pending_sync = 1;
    CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_transactions_pending ON transactions(pending_sync) WHERE pending_sync = 1;
    CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(synced_at) WHERE synced_at IS NULL;
  `);
}

// Close the database (for cleanup)
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

// Reset the database (for development/testing)
export async function resetDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
  await SQLite.deleteDatabaseAsync(DB_NAME);
}

# Production-Ready App Master Checklist

**Generated from RoadLedger Project - January 2026**

This document captures all lessons learned, best practices, and configurations needed to ship a production-ready mobile app to the App Store.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Tech Stack Recommendations](#2-tech-stack-recommendations)
3. [Security Hardening](#3-security-hardening)
4. [Database Design](#4-database-design)
5. [Authentication](#5-authentication)
6. [Offline-First Architecture](#6-offline-first-architecture)
7. [In-App Purchases & Subscriptions](#7-in-app-purchases--subscriptions)
8. [Push Notifications](#8-push-notifications)
9. [CI/CD Pipeline](#9-cicd-pipeline)
10. [App Store Compliance](#10-app-store-compliance)
11. [Common Bugs & Fixes](#11-common-bugs--fixes)
12. [Performance Optimization](#12-performance-optimization)
13. [Testing Strategy](#13-testing-strategy)
14. [Accessibility (WCAG 2.1 AA)](#14-accessibility-wcag-21-aa)
15. [Legal & Privacy Compliance](#15-legal--privacy-compliance)
16. [Launch Checklist](#16-launch-checklist)

---

## 1. Project Structure

### Recommended Expo Router Structure

```
my-app/
├── app/                          # Expo Router screens
│   ├── (auth)/                   # Authentication flow (unauthenticated)
│   │   ├── _layout.tsx           # Auth layout (no tabs)
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── forgot-password.tsx
│   │   └── onboarding.tsx
│   ├── (tabs)/                   # Main app (authenticated)
│   │   ├── _layout.tsx           # Tab navigator
│   │   ├── index.tsx             # Dashboard/Home
│   │   ├── [feature]/            # Feature-specific screens
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx
│   │   │   └── [id].tsx          # Dynamic routes
│   │   ├── settings/             # Settings screens
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx
│   │   │   ├── privacy.tsx
│   │   │   ├── accessibility.tsx
│   │   │   └── legal.tsx
│   │   └── subscription.tsx      # IAP/Subscription screen
│   ├── (admin)/                  # Admin-only screens
│   └── _layout.tsx               # Root layout
├── src/
│   ├── components/               # Reusable UI components
│   ├── hooks/                    # Custom React hooks
│   ├── stores/                   # Zustand state stores
│   ├── services/                 # Business logic
│   │   ├── auth/                 # Authentication services
│   │   ├── sync/                 # Offline sync engine
│   │   ├── notifications/        # Push notifications
│   │   ├── analytics/            # Event tracking
│   │   └── subscription/         # IAP services
│   ├── lib/                      # Database, API clients
│   │   ├── supabase.ts           # Supabase client
│   │   └── database/             # SQLite local DB
│   │       ├── schema.ts
│   │       ├── queries.ts
│   │       └── index.ts
│   ├── constants/                # App constants
│   │   ├── legal.ts              # Terms, Privacy Policy
│   │   ├── pricing.ts            # Subscription tiers
│   │   └── categories.ts         # App-specific enums
│   └── types/                    # TypeScript definitions
├── supabase/
│   ├── migrations/               # SQL migrations
│   └── functions/                # Edge Functions
├── __tests__/                    # Test files
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── security/
├── assets/
│   ├── images/
│   ├── fonts/
│   └── appstore/                 # App Store screenshots
├── .github/
│   └── workflows/
│       └── ci.yml                # GitHub Actions CI
├── app.json                      # Expo config
├── eas.json                      # EAS Build config
├── package.json
└── tsconfig.json
```

### Key Layout Patterns

**Root Layout (`app/_layout.tsx`)**
```typescript
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { notificationService } from '@/services/notifications/notificationService';

export default function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  useEffect(() => {
    async function init() {
      // Critical: Auth first
      await initialize();

      // Non-critical: Don't block app startup
      try {
        await notificationService.initialize();
      } catch (error) {
        console.error('Non-critical init error:', error);
      }
    }
    init();
  }, []);

  if (!isInitialized) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </QueryClientProvider>
  );
}
```

**Tabs Layout with Auth Guard (`app/(tabs)/_layout.tsx`)**
```typescript
import { Redirect, Tabs } from 'expo-router';
import { useIsAuthenticated } from '@/stores/authStore';

export default function TabsLayout() {
  const isAuthenticated = useIsAuthenticated();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      {/* Hidden screens accessible via navigation */}
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
```

---

## 2. Tech Stack Recommendations

### Core Stack (Tested & Production-Ready)

| Component | Technology | Version | Notes |
|-----------|------------|---------|-------|
| Framework | Expo SDK | 54+ | Managed workflow |
| Language | TypeScript | 5.x | Strict mode enabled |
| Routing | Expo Router | 6+ | File-based routing |
| Backend | Supabase | Latest | Postgres + Auth + Storage + Edge Functions |
| State | Zustand | 4.x | Simple, performant |
| Queries | TanStack Query | 5.x | Server state management |
| Local DB | expo-sqlite | 16.x | Offline-first |
| AI/OCR | OpenAI GPT-4 Vision | - | Document extraction |
| IAP | expo-in-app-purchases | 16.x | Apple/Google subscriptions |
| Notifications | expo-notifications | 0.32+ | Push notifications |

### Package.json Essential Dependencies

```json
{
  "dependencies": {
    "expo": "~54.0.0",
    "expo-router": "~6.0.0",
    "react": "19.1.0",
    "react-native": "0.81.5",
    "@supabase/supabase-js": "^2.45.0",
    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.60.0",
    "expo-sqlite": "~16.0.0",
    "expo-crypto": "~14.1.0",
    "expo-location": "~18.1.0",
    "expo-notifications": "~0.32.0",
    "expo-in-app-purchases": "~16.1.1",
    "expo-secure-store": "~14.1.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "typescript": "^5.9.0",
    "@types/react": "~19.0.0",
    "jest": "^29.7.0",
    "@testing-library/react-native": "^12.0.0"
  }
}
```

### Critical: Use expo-crypto Instead of uuid

```typescript
// BAD: Causes native module crashes
import { v4 as uuidv4 } from 'uuid';

// GOOD: Works in Expo managed workflow
import * as Crypto from 'expo-crypto';
const id = Crypto.randomUUID();
```

### Version Compatibility Check

Always run before building:
```bash
npx expo-doctor
npx expo install --check
```

---

## 3. Security Hardening

### Row Level Security (RLS) - Supabase

**Enable RLS on ALL tables:**
```sql
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
```

**User can only access their own data:**
```sql
CREATE POLICY "Users can view own data" ON your_table
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data" ON your_table
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data" ON your_table
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own data" ON your_table
  FOR DELETE USING (auth.uid() = user_id);
```

**Admin bypass function:**
```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Use in policies:
CREATE POLICY "Admins can view all" ON your_table
  FOR SELECT USING (is_admin());
```

### Edge Function Security Pattern

```typescript
// supabase/functions/your-function/index.ts
import { createClient } from '@supabase/supabase-js';

const RATE_LIMIT_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60000;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_REQUESTS) {
    return false;
  }

  userLimit.count++;
  return true;
}

function safeErrorResponse(message: string, status: number = 400) {
  // Never expose internal errors to client
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req) => {
  try {
    // 1. Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return safeErrorResponse('Unauthorized', 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return safeErrorResponse('Unauthorized', 401);
    }

    // 2. Rate limiting
    if (!checkRateLimit(user.id)) {
      return safeErrorResponse('Rate limit exceeded', 429);
    }

    // 3. Input validation
    const body = await req.json();
    if (!body.requiredField || typeof body.requiredField !== 'string') {
      return safeErrorResponse('Invalid input');
    }

    // 4. Verify ownership for any data access
    const { data: record } = await supabase
      .from('your_table')
      .select('user_id')
      .eq('id', body.recordId)
      .single();

    if (record?.user_id !== user.id) {
      return safeErrorResponse('Forbidden', 403);
    }

    // 5. Process request...
    return new Response(JSON.stringify({ success: true }));

  } catch (error) {
    console.error('Error:', error);
    return safeErrorResponse('Internal server error', 500);
  }
});
```

### Secrets Management

**Never commit secrets. Use environment variables:**

```bash
# .env.local (gitignored)
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Supabase Edge Function secrets (set via CLI)
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set APPLE_SHARED_SECRET=...
```

### Admin Audit Logging

```sql
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger function for automatic logging
CREATE OR REPLACE FUNCTION log_admin_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id::TEXT);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. Database Design

### Local SQLite Schema Pattern

```typescript
// src/lib/database/schema.ts
import * as SQLite from 'expo-sqlite';

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('myapp.db');
  await initializeSchema(db);
  return db;
}

async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA foreign_keys = ON;

    -- Sync queue for offline operations
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
      record_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      retry_count INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT
    );

    -- Your tables with sync tracking
    CREATE TABLE IF NOT EXISTS your_table (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      -- your fields...
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      pending_sync INTEGER NOT NULL DEFAULT 1
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_your_table_user ON your_table(user_id);
    CREATE INDEX IF NOT EXISTS idx_your_table_pending ON your_table(pending_sync)
      WHERE pending_sync = 1;
    CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(synced_at)
      WHERE synced_at IS NULL;
  `);
}
```

### Query Patterns

```typescript
// src/lib/database/queries.ts
import * as Crypto from 'expo-crypto';
import { getDatabase } from './schema';

export async function createRecord(userId: string, data: Partial<YourType>): Promise<YourType> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO your_table (id, user_id, field1, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId, data.field1, now, now]
  );

  // Queue for sync
  await db.runAsync(
    `INSERT INTO sync_queue (table_name, operation, record_id, payload)
     VALUES (?, ?, ?, ?)`,
    ['your_table', 'INSERT', id, JSON.stringify({ ...data, id, user_id: userId })]
  );

  return { id, user_id: userId, ...data, created_at: now, updated_at: now };
}

export async function getRecords(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<YourType[]> {
  const db = await getDatabase();
  const { limit = 50, offset = 0 } = options;

  const result = await db.getAllAsync<YourType>(
    `SELECT * FROM your_table WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  return result;
}
```

---

## 5. Authentication

### Zustand Auth Store Pattern

```typescript
// src/stores/authStore.ts
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isInitialized: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        set({ user: session.user, session, profile });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          set({ user: session.user, session, profile });
        } else {
          set({ user: null, session: null, profile: null });
        }
      });
    } finally {
      set({ isInitialized: true });
    }
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    set({ profile });
  },
}));

// Selector hooks
export const useUser = () => useAuthStore((state) => state.user);
export const useProfile = () => useAuthStore((state) => state.profile);
export const useIsAuthenticated = () => useAuthStore((state) => !!state.session);
```

### Biometric Authentication

```typescript
// src/services/auth/biometricService.ts
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

export const biometricService = {
  async checkCapabilities() {
    const isAvailable = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    const biometricType = supportedTypes.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
    ) ? 'Face ID' : 'Touch ID';

    return {
      isAvailable: isAvailable && isEnrolled,
      biometricTypeName: biometricType,
    };
  },

  async authenticate(promptMessage: string) {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Passcode',
      cancelLabel: 'Cancel',
    });
    return result;
  },

  async isEnabled(): Promise<boolean> {
    const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return value === 'true';
  },

  async setEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  },
};
```

---

## 6. Offline-First Architecture

### Sync Engine Pattern

```typescript
// src/services/sync/syncEngine.ts
import { supabase } from '@/lib/supabase';
import { getDatabase } from '@/lib/database';
import NetInfo from '@react-native-community/netinfo';

class SyncEngine {
  private isOnline = false;
  private syncInProgress = false;

  async initialize() {
    // Monitor network status
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      // Sync when coming back online
      if (wasOffline && this.isOnline) {
        this.sync();
      }
    });
  }

  async sync() {
    if (!this.isOnline || this.syncInProgress) return;

    this.syncInProgress = true;
    try {
      await this.pushPendingChanges();
      await this.pullRemoteChanges();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async pushPendingChanges() {
    const db = await getDatabase();
    const pending = await db.getAllAsync<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY created_at ASC LIMIT 50`
    );

    for (const item of pending) {
      try {
        const payload = JSON.parse(item.payload);

        switch (item.operation) {
          case 'INSERT':
            await supabase.from(item.table_name).insert(payload);
            break;
          case 'UPDATE':
            await supabase.from(item.table_name).update(payload).eq('id', item.record_id);
            break;
          case 'DELETE':
            await supabase.from(item.table_name).delete().eq('id', item.record_id);
            break;
        }

        // Mark as synced
        await db.runAsync(
          `UPDATE sync_queue SET synced_at = datetime('now') WHERE id = ?`,
          [item.id]
        );

        // Update local record
        await db.runAsync(
          `UPDATE ${item.table_name} SET pending_sync = 0, synced_at = datetime('now') WHERE id = ?`,
          [item.record_id]
        );
      } catch (error) {
        // Increment retry count
        await db.runAsync(
          `UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?`,
          [error.message, item.id]
        );
      }
    }
  }

  private async pullRemoteChanges() {
    // Implement based on your sync strategy
    // e.g., fetch records updated since last sync
  }
}

export const syncEngine = new SyncEngine();
```

### Sync Status Store

```typescript
// src/stores/syncStore.ts
import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

interface SyncState {
  isOnline: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncAt: Date | null;
  pendingCount: number;
  checkNetworkStatus: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: true,
  syncStatus: 'idle',
  lastSyncAt: null,
  pendingCount: 0,

  checkNetworkStatus: async () => {
    const state = await NetInfo.fetch();
    set({ isOnline: state.isConnected ?? false });
  },
}));

export const useIsOnline = () => useSyncStore((state) => state.isOnline);
export const useSyncStatus = () => useSyncStore((state) => state.syncStatus);
```

---

## 7. In-App Purchases & Subscriptions

### Apple IAP Setup

**app.json:**
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp",
      "usesIcloudStorage": false,
      "config": {
        "usesNonExemptEncryption": false
      }
    },
    "plugins": [
      "expo-in-app-purchases"
    ]
  }
}
```

### Subscription Service

```typescript
// src/services/subscription/subscriptionService.ts
import * as InAppPurchases from 'expo-in-app-purchases';
import { supabase } from '@/lib/supabase';

const PRODUCT_IDS = {
  PRO_MONTHLY: 'com.yourapp.pro.monthly',
  PRO_YEARLY: 'com.yourapp.pro.yearly',
  PREMIUM_MONTHLY: 'com.yourapp.premium.monthly',
  PREMIUM_YEARLY: 'com.yourapp.premium.yearly',
};

class SubscriptionService {
  private isConnected = false;

  async initialize() {
    try {
      await InAppPurchases.connectAsync();
      this.isConnected = true;

      // Set up purchase listener
      InAppPurchases.setPurchaseListener(this.handlePurchase.bind(this));
    } catch (error) {
      console.error('IAP init failed:', error);
    }
  }

  async getProducts() {
    if (!this.isConnected) return [];

    const { results } = await InAppPurchases.getProductsAsync(
      Object.values(PRODUCT_IDS)
    );
    return results;
  }

  async purchase(productId: string) {
    if (!this.isConnected) throw new Error('IAP not connected');
    await InAppPurchases.purchaseItemAsync(productId);
  }

  async restorePurchases() {
    if (!this.isConnected) throw new Error('IAP not connected');

    const { results } = await InAppPurchases.getPurchaseHistoryAsync();

    for (const purchase of results) {
      if (purchase.acknowledged) {
        await this.validateAndActivate(purchase);
      }
    }
  }

  private async handlePurchase({ responseCode, results }: InAppPurchases.PurchaseResult) {
    if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
      for (const purchase of results) {
        await this.validateAndActivate(purchase);
        await InAppPurchases.finishTransactionAsync(purchase, true);
      }
    }
  }

  private async validateAndActivate(purchase: InAppPurchases.InAppPurchase) {
    // Validate receipt server-side
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/validate-receipt`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiptData: purchase.transactionReceipt,
          productId: purchase.productId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Receipt validation failed');
    }
  }

  async disconnect() {
    if (this.isConnected) {
      await InAppPurchases.disconnectAsync();
      this.isConnected = false;
    }
  }
}

export const subscriptionService = new SubscriptionService();
```

### Receipt Validation Edge Function

```typescript
// supabase/functions/validate-receipt/index.ts
Deno.serve(async (req) => {
  // Verify auth
  const authHeader = req.headers.get('Authorization');
  const supabase = createClient(/* ... */);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return new Response('Unauthorized', { status: 401 });

  const { receiptData, productId } = await req.json();

  // Validate with Apple
  const verifyUrl = Deno.env.get('APPLE_ENV') === 'production'
    ? 'https://buy.itunes.apple.com/verifyReceipt'
    : 'https://sandbox.itunes.apple.com/verifyReceipt';

  const response = await fetch(verifyUrl, {
    method: 'POST',
    body: JSON.stringify({
      'receipt-data': receiptData,
      'password': Deno.env.get('APPLE_SHARED_SECRET'),
      'exclude-old-transactions': true,
    }),
  });

  const result = await response.json();

  if (result.status !== 0) {
    return new Response(JSON.stringify({ error: 'Invalid receipt' }), { status: 400 });
  }

  // Determine tier from product ID
  const tier = productId.includes('premium') ? 'premium' : 'pro';
  const isYearly = productId.includes('yearly');

  // Calculate expiry
  const latestReceipt = result.latest_receipt_info?.[0];
  const expiresAt = latestReceipt?.expires_date_ms
    ? new Date(parseInt(latestReceipt.expires_date_ms))
    : new Date(Date.now() + (isYearly ? 365 : 30) * 24 * 60 * 60 * 1000);

  // Update user subscription
  await supabase.from('subscriptions').upsert({
    user_id: user.id,
    tier,
    product_id: productId,
    expires_at: expiresAt.toISOString(),
    original_transaction_id: latestReceipt?.original_transaction_id,
  });

  // Update profile tier
  await supabase.from('profiles').update({ tier }).eq('id', user.id);

  return new Response(JSON.stringify({ success: true, tier, expiresAt }));
});
```

---

## 8. Push Notifications

### Notification Service

```typescript
// src/services/notifications/notificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configure behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  private pushToken: string | null = null;

  async initialize(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('Push notifications require physical device');
      return null;
    }

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // Get token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    this.pushToken = token.data;

    // Configure Android channels
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    return this.pushToken;
  }

  async scheduleLocalNotification(
    title: string,
    body: string,
    trigger: Date | null,
    data?: Record<string, unknown>
  ): Promise<string> {
    return Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: trigger ? { type: 'date', date: trigger } : null,
    });
  }

  async cancelNotification(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  setupListeners(
    onReceive?: (notification: Notifications.Notification) => void,
    onTap?: (response: Notifications.NotificationResponse) => void
  ) {
    const receiveSubscription = Notifications.addNotificationReceivedListener(
      (notification) => onReceive?.(notification)
    );

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => onTap?.(response)
    );

    return () => {
      receiveSubscription.remove();
      responseSubscription.remove();
    };
  }
}

export const notificationService = new NotificationService();
```

### Scheduled Reminders Pattern

```typescript
// Schedule deadline reminders
async function scheduleDeadlineReminders(daysBefore: number = 7) {
  const deadlines = [
    { quarter: 'Q1', month: 3, day: 30 },  // April 30
    { quarter: 'Q2', month: 6, day: 31 },  // July 31
    { quarter: 'Q3', month: 9, day: 31 },  // October 31
    { quarter: 'Q4', month: 0, day: 31 },  // January 31
  ];

  const now = new Date();
  const currentYear = now.getFullYear();

  for (const deadline of deadlines) {
    let deadlineDate = new Date(currentYear, deadline.month, deadline.day);

    // Handle Q4 (next year)
    if (deadline.quarter === 'Q4') {
      deadlineDate = new Date(currentYear + 1, 0, 31);
    }

    // If passed, schedule for next year
    if (deadlineDate < now) {
      deadlineDate.setFullYear(deadlineDate.getFullYear() + 1);
    }

    const reminderDate = new Date(deadlineDate);
    reminderDate.setDate(reminderDate.getDate() - daysBefore);

    if (reminderDate > now) {
      await notificationService.scheduleLocalNotification(
        `${deadline.quarter} Filing Due Soon`,
        `Your quarterly report is due on ${deadlineDate.toLocaleDateString()}`,
        reminderDate,
        { type: 'deadline_reminder', quarter: deadline.quarter }
      );
    }
  }
}
```

---

## 9. CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: App CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20.x'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  security-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm audit --audit-level=high
      - name: Check for secrets
        run: |
          if grep -rE "(sk-[a-zA-Z0-9]{48}|password\s*=|api_key\s*=)" --include="*.ts" --include="*.tsx" --include="*.js" src/; then
            echo "Potential secrets found in code!"
            exit 1
          fi

  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit

  expo-doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npx expo-doctor
      - run: npx expo export --platform ios --output-dir dist

  edge-functions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      - name: Lint Edge Functions
        run: |
          for dir in supabase/functions/*/; do
            deno lint "$dir"
          done
      - name: Type Check
        run: |
          for dir in supabase/functions/*/; do
            deno check "$dir/index.ts"
          done

  deploy-preview:
    needs: [unit-tests, security-audit, lint-typecheck, expo-doctor]
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: eas build --platform ios --profile preview --non-interactive

  deploy-production:
    needs: [unit-tests, security-audit, lint-typecheck, expo-doctor]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: eas build --platform ios --profile production --auto-submit --non-interactive
```

### EAS Build Configuration

```json
// eas.json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium"
      },
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://xxx.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJ..."
      }
    },
    "production": {
      "ios": {
        "resourceClass": "m-medium"
      },
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://xxx.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJ..."
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "123456789",
        "appleTeamId": "XXXXXXXXXX"
      }
    }
  }
}
```

---

## 10. App Store Compliance

### app.json Complete Configuration

```json
{
  "expo": {
    "name": "Your App",
    "slug": "your-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1a1a2e"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.yourapp",
      "buildNumber": "1",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "We use your location to track mileage by state for IFTA reporting.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Background location is used to continue tracking trips while you drive.",
        "NSLocationAlwaysUsageDescription": "Background location ensures accurate mileage tracking during your trips.",
        "NSCameraUsageDescription": "Camera is used to scan receipts and documents.",
        "NSPhotoLibraryUsageDescription": "Photo library access is used to upload receipt images.",
        "NSFaceIDUsageDescription": "Face ID is used for secure login.",
        "UIBackgroundModes": ["location", "fetch", "remote-notification"]
      },
      "config": {
        "usesNonExemptEncryption": false
      },
      "associatedDomains": [
        "applinks:yourapp.com",
        "webcredentials:yourapp.com"
      ]
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1a1a2e"
      },
      "package": "com.yourcompany.yourapp",
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE"
      ]
    },
    "plugins": [
      "expo-router",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location to track trips.",
          "locationAlwaysPermission": "Allow $(PRODUCT_NAME) to use your location in the background.",
          "locationWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location.",
          "isAndroidBackgroundLocationEnabled": true,
          "isIosBackgroundLocationEnabled": true
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera to scan documents."
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#2ECC71"
        }
      ],
      "expo-secure-store",
      "expo-in-app-purchases"
    ],
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id"
      }
    }
  }
}
```

### Required App Store Assets

```
assets/appstore/
├── AppIcon-1024x1024.png         # Required: App icon (no alpha/transparency)
├── iPhone-6.5-1.png              # Required: 1284x2778 (iPhone 14 Pro Max)
├── iPhone-6.5-2.png
├── iPhone-6.5-3.png
├── iPhone-5.5-1.png              # Required: 1242x2208 (iPhone 8 Plus)
├── iPhone-5.5-2.png
├── iPhone-5.5-3.png
├── iPad-12.9-1.png               # Required if iPad supported: 2048x2732
└── iPad-12.9-2.png
```

### App Store Metadata Checklist

- [ ] App name (30 characters max)
- [ ] Subtitle (30 characters max)
- [ ] Keywords (100 characters, comma-separated)
- [ ] Description (4000 characters max)
- [ ] What's New text
- [ ] Support URL
- [ ] Marketing URL
- [ ] Privacy Policy URL (REQUIRED)
- [ ] Age Rating questionnaire
- [ ] App category (primary + secondary)
- [ ] Copyright (e.g., "© 2026 Your Company LLC")
- [ ] Contact information

---

## 11. Common Bugs & Fixes

### App Startup Crash - Resilient Initialization

**Problem:** App crashes on startup due to non-critical service failures.

**Solution:** Separate critical and non-critical initialization:

```typescript
useEffect(() => {
  async function init() {
    try {
      // CRITICAL: Must succeed
      await initialize();
      await SplashScreen.hideAsync();
    } catch (error) {
      console.error('Critical init failed:', error);
      return;
    }

    // NON-CRITICAL: Don't block app
    try {
      await syncEngine.initialize();
    } catch (error) {
      console.error('Sync init error:', error);
    }

    try {
      await analytics.initialize();
    } catch (error) {
      console.error('Analytics init error:', error);
    }

    try {
      await notificationService.initialize();
    } catch (error) {
      console.error('Notification init error:', error);
    }
  }
  init();
}, []);
```

### Dynamic Import Crashes in React Native

**Problem:** `await import('react-native')` crashes on some devices.

**Solution:** Use `require()` instead:

```typescript
// BAD
const { Platform } = await import('react-native');

// GOOD
const { Platform } = require('react-native');
```

### Timer Type Mismatch

**Problem:** `setInterval` returns `number` in React Native, not `NodeJS.Timeout`.

**Solution:**
```typescript
// BAD
const timerRef = useRef<NodeJS.Timeout | null>(null);

// GOOD
const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

### Expo Router Type Errors

**Problem:** New routes not recognized by TypeScript.

**Solution:** Use type assertion for dynamic routes:
```typescript
router.push('/newscreen' as any);
router.push({ pathname: '/screen/add' as any, params: { id: '123' } });
```

### npm Audit Security Vulnerabilities

**Problem:** CI fails due to security vulnerabilities in dependencies.

**Solution:**
```bash
# Fix automatically
npm audit fix

# If that doesn't work, check what can be fixed
npm audit

# For transitive dependencies, update the parent package
npm update package-name
```

### Expo SDK Version Mismatch

**Problem:** Package version doesn't match Expo SDK requirements.

**Solution:**
```bash
# Check for mismatches
npx expo-doctor

# Auto-fix to correct versions
npx expo install --check
npx expo install package-name@~correct.version
```

---

## 12. Performance Optimization

### Image Optimization

```typescript
import { Image } from 'expo-image';

// Use expo-image instead of React Native Image
<Image
  source={{ uri: imageUrl }}
  style={styles.image}
  contentFit="cover"
  transition={200}
  placeholder={blurhash}
  cachePolicy="memory-disk"
/>
```

### List Virtualization

```typescript
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={items}
  renderItem={({ item }) => <ItemComponent item={item} />}
  estimatedItemSize={80}
  keyExtractor={(item) => item.id}
/>
```

### Memoization

```typescript
import { memo, useMemo, useCallback } from 'react';

// Memoize expensive calculations
const sortedItems = useMemo(() =>
  items.sort((a, b) => b.date - a.date),
  [items]
);

// Memoize callbacks
const handlePress = useCallback((id: string) => {
  router.push(`/item/${id}`);
}, []);

// Memoize components
const ItemComponent = memo(({ item }: { item: Item }) => (
  <View>...</View>
));
```

### Database Query Optimization

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_table_user_date ON your_table(user_id, created_at);

-- Use partial indexes for filtered queries
CREATE INDEX idx_table_pending ON your_table(pending_sync) WHERE pending_sync = 1;

-- Limit query results
SELECT * FROM your_table WHERE user_id = ? ORDER BY created_at DESC LIMIT 50;
```

### Bundle Size Reduction

```javascript
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Tree-shake lodash
      'lodash',
      // Remove console.log in production
      ['transform-remove-console', { exclude: ['error', 'warn'] }],
    ],
  };
};
```

---

## 13. Testing Strategy

### Test Structure

```
__tests__/
├── unit/
│   ├── components/
│   │   └── Button.test.tsx
│   ├── hooks/
│   │   └── useAuth.test.ts
│   ├── services/
│   │   └── syncEngine.test.ts
│   └── utils/
│       └── formatters.test.ts
├── integration/
│   ├── auth.test.ts
│   └── database.test.ts
├── e2e/
│   └── golden-path.test.ts
└── security/
    ├── rls.test.ts
    ├── input-validation.test.ts
    └── ai-injection.test.ts
```

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### Component Testing

```typescript
// __tests__/unit/components/Button.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/Button';

describe('Button', () => {
  it('renders correctly', () => {
    const { getByText } = render(<Button title="Click me" onPress={() => {}} />);
    expect(getByText('Click me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button title="Click me" onPress={onPress} />);

    fireEvent.press(getByText('Click me'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button title="Click me" onPress={onPress} loading />
    );

    fireEvent.press(getByText('Click me'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
```

### Security Testing

```typescript
// __tests__/security/rls.test.ts
import { createClient } from '@supabase/supabase-js';

describe('Row Level Security', () => {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

  it('prevents access to other users data', async () => {
    // Sign in as User A
    await supabase.auth.signInWithPassword({ email: 'usera@test.com', password: 'test123' });

    // Try to access User B's data
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', 'user-b-id');

    expect(data).toHaveLength(0); // Should not see User B's data
  });

  it('allows users to access their own data', async () => {
    await supabase.auth.signInWithPassword({ email: 'usera@test.com', password: 'test123' });

    const { data, error } = await supabase
      .from('trips')
      .select('*');

    expect(error).toBeNull();
    expect(data?.every(trip => trip.user_id === 'user-a-id')).toBe(true);
  });
});
```

---

## 14. Accessibility (WCAG 2.1 AA)

### Essential Accessibility Props

```typescript
<TouchableOpacity
  accessibilityLabel="Start new trip"
  accessibilityHint="Double tap to begin tracking your trip"
  accessibilityRole="button"
  accessible={true}
  style={{ minWidth: 44, minHeight: 44 }} // Minimum touch target
>
  <Text>Start Trip</Text>
</TouchableOpacity>

<TextInput
  accessibilityLabel="Email address"
  accessibilityHint="Enter your email to sign in"
  accessible={true}
/>

<View
  accessibilityRole="header"
  accessibilityLabel="Dashboard"
>
  <Text style={styles.header}>Dashboard</Text>
</View>
```

### Accessibility Settings Screen

```typescript
// app/(tabs)/settings/accessibility.tsx
const accessibilityOptions = [
  {
    key: 'highContrast',
    label: 'High Contrast Mode',
    description: 'Increase contrast for better visibility',
  },
  {
    key: 'largeText',
    label: 'Large Text',
    description: 'Increase text size throughout the app',
  },
  {
    key: 'reduceMotion',
    label: 'Reduce Motion',
    description: 'Minimize animations and transitions',
  },
  {
    key: 'screenReader',
    label: 'Screen Reader Optimization',
    description: 'Optimize for VoiceOver and TalkBack',
  },
];
```

### Color Contrast Requirements

```typescript
// Minimum contrast ratios (WCAG 2.1 AA)
// Normal text: 4.5:1
// Large text (18pt+): 3:1
// UI components: 3:1

const COLORS = {
  // Good contrast on dark backgrounds
  text: '#FFFFFF',           // On #1a1a2e = 12.6:1 ✓
  textSecondary: '#8892A0',  // On #1a1a2e = 4.8:1 ✓

  // Interactive elements
  primary: '#2ECC71',        // Bright enough for touch targets
  danger: '#E74C3C',         // Clear warning color
};
```

---

## 15. Legal & Privacy Compliance

### Legal Constants

```typescript
// src/constants/legal.ts
export const LEGAL_VERSION = '1.0.0';
export const LEGAL_EFFECTIVE_DATE = 'January 14, 2026';

export const COMPANY_INFO = {
  name: 'Your Company LLC',
  dba: 'Your App',
  address: '123 Main St, City, ST 12345',
  phone: '(555) 123-4567',
  email: 'support@yourapp.com',
  privacyEmail: 'privacy@yourapp.com',
};

export const TERMS_OF_SERVICE = `
# Terms of Service

Last Updated: ${LEGAL_EFFECTIVE_DATE}
Version: ${LEGAL_VERSION}

## 1. Acceptance of Terms

By downloading, installing, or using ${COMPANY_INFO.dba} ("the App"), you agree to be bound by these Terms of Service...

[Full terms content]
`;

export const PRIVACY_POLICY = `
# Privacy Policy

Last Updated: ${LEGAL_EFFECTIVE_DATE}

## Information We Collect

### Information You Provide
- Account information (email, name)
- Financial data (transactions, receipts)
- Location data (with your permission)

### Automatic Collection
- Device information
- Usage analytics
- Crash reports

## How We Use Information
...

## Your Rights (GDPR/CCPA)
- Right to access your data
- Right to delete your data
- Right to data portability
- Right to opt-out of data sales

## Contact Us
${COMPANY_INFO.email}
`;
```

### Data Deletion Request System

```sql
-- Table for tracking deletion requests
CREATE TABLE data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled'))
);

-- RLS: Users can create their own requests
CREATE POLICY "Users can request deletion" ON data_deletion_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Consent Tracking

```sql
CREATE TABLE user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  consent_type TEXT NOT NULL, -- 'terms', 'privacy', 'marketing', 'analytics', 'location'
  version TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 16. Launch Checklist

### Pre-Launch (1 Week Before)

- [ ] All features implemented and tested
- [ ] TypeScript compiles with no errors (`npx tsc --noEmit`)
- [ ] ESLint passes (`npm run lint`)
- [ ] All unit tests pass (`npm test`)
- [ ] Security audit passes (`npm audit --audit-level=high`)
- [ ] Expo doctor passes (`npx expo-doctor`)
- [ ] Edge functions deployed to Supabase
- [ ] API keys configured in Supabase secrets
- [ ] RLS policies verified on all tables
- [ ] Database migrations applied
- [ ] App Store assets created (icon, screenshots)
- [ ] App Store metadata prepared
- [ ] Privacy Policy URL live
- [ ] Terms of Service URL live

### Build & Submit (3-5 Days Before)

- [ ] Production build created (`eas build --platform ios --profile production`)
- [ ] Build tested on physical devices
- [ ] App submitted to App Store Connect
- [ ] All compliance questions answered
- [ ] Export compliance confirmed
- [ ] Age rating set
- [ ] Pricing configured
- [ ] In-app purchases configured and approved

### Post-Submission

- [ ] Monitor App Store Connect for review status
- [ ] Prepare for potential rejection feedback
- [ ] Have hotfix branch ready
- [ ] Analytics dashboard set up
- [ ] Error monitoring configured (Sentry)
- [ ] Customer support system ready
- [ ] Social media announcement prepared

### Launch Day

- [ ] App approved and released
- [ ] Verify app is downloadable
- [ ] Test purchase flow
- [ ] Monitor crash reports
- [ ] Monitor user feedback
- [ ] Celebrate! 🎉

---

## Quick Reference Commands

```bash
# Development
npx expo start                          # Start dev server
npx tsc --noEmit                        # TypeScript check
npm run lint                            # ESLint check
npm test                                # Run tests

# Dependency Management
npx expo-doctor                         # Check Expo compatibility
npx expo install --check                # Check for version mismatches
npm audit fix                           # Fix security vulnerabilities

# Database
npx supabase link --project-ref xxx     # Link to Supabase project
npx supabase db push                    # Push migrations
npx supabase functions deploy           # Deploy edge functions

# Building
eas build --platform ios --profile preview      # Preview build
eas build --platform ios --profile production   # Production build
eas submit --platform ios                       # Submit to App Store

# Git
git add -A && git commit -m "message" && git push origin main
```

---

**Document Version:** 1.0.0
**Last Updated:** January 17, 2026
**Source Project:** RoadLedger

This document should be treated as a living reference. Update it as you discover new patterns and solutions.

// In-memory store for OAuth state (fallback when cookies fail)
// In production, consider using Redis or a database

interface OAuthState {
  state: string;
  codeVerifier: string;
  expiresAt: number;
  createdAt: number;
}

const stateStore = new Map<string, OAuthState>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of stateStore.entries()) {
    if (value.expiresAt < now) {
      stateStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function storeOAuthState(state: string, codeVerifier: string, ttlSeconds = 600): void {
  const now = Date.now();
  stateStore.set(state, {
    state,
    codeVerifier,
    expiresAt: now + ttlSeconds * 1000,
    createdAt: now,
  });
  console.log('Stored OAuth state in memory:', {
    state,
    storeSize: stateStore.size,
    expiresIn: ttlSeconds,
  });
}

export function getOAuthState(state: string): OAuthState | undefined {
  const stored = stateStore.get(state);
  if (stored) {
    if (stored.expiresAt > Date.now()) {
      console.log('Found OAuth state in memory:', {
        state,
        age: Date.now() - stored.createdAt,
        expiresIn: stored.expiresAt - Date.now(),
      });
      return stored;
    } else {
      console.log('OAuth state expired in memory:', {
        state,
        expired: Date.now() - stored.expiresAt,
      });
      stateStore.delete(state); // Clean up expired
    }
  } else {
    console.log('OAuth state not found in memory:', {
      state,
      availableStates: Array.from(stateStore.keys()).slice(0, 5),
      storeSize: stateStore.size,
    });
  }
  return undefined;
}

export function deleteOAuthState(state: string): void {
  const deleted = stateStore.delete(state);
  console.log('Deleted OAuth state from memory:', { state, deleted });
}

// Get all states for debugging
export function getAllStates(): Array<{ state: string; age: number; expiresIn: number }> {
  const now = Date.now();
  return Array.from(stateStore.entries()).map(([state, value]) => ({
    state,
    age: now - value.createdAt,
    expiresIn: value.expiresAt - now,
  }));
}


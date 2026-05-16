# Security Specification - Astrovia Enterprise (Nepawahala)

## 1. Data Invariants
- A `log` must belong to the user who created it (`userId` matches `auth.uid`).
- A `log` must have a valid `status` ('on' or 'off').
- A `log` must have a server-generated `timestamp`.
- A `user` profile can only be written to by that specific user.
- User email in profile is immutable or must match the auth token.
- Document IDs must be valid strings restricted to alphanumeric and specific symbols.

## 2. The "Dirty Dozen" Payloads (Attacks)

### Attack 1: Identity Spoofing (Logs)
- **Payload**: `{ "userId": "attacker_id", "status": "on", ... }` targeting `logs/anyId`.
- **Expected**: `PERMISSION_DENIED` because `userId` doesn't match `auth.uid`.

### Attack 2: System Field Poisoning (Logs)
- **Payload**: `{ "timestamp": "2020-01-01T00:00:00Z", ... }` targeting `logs/anyId`.
- **Expected**: `PERMISSION_DENIED` because `timestamp` must be `request.time`.

### Attack 3: Resource Exhaustion (Long Strings - Logs)
- **Payload**: `{ "userName": "A".repeat(2000), ... }`
- **Expected**: `PERMISSION_DENIED` because `userName` size exceeds limit.

### Attack 4: PII Leak (User Reading)
- **Operation**: `get` on `/users/victim_id` by `attacker_id`.
- **Expected**: `PERMISSION_DENIED` (unless explicitly public fields).

### Attack 5: ID Poisoning
- **Operation**: `create` on `/logs/very_long_invalid_id_!!!`
- **Expected**: `PERMISSION_DENIED` because document ID is invalid/oversized.

### Attack 6: State Shortcut (Logs)
- **Payload**: `{ "status": "maybe", ... }`
- **Expected**: `PERMISSION_DENIED` because `status` is not in enum.

### Attack 7: Orphaned Write (Users)
- **Payload**: Updating another user's profile.
- **Expected**: `PERMISSION_DENIED`.

### Attack 8: Field Injection (Ghost Field)
- **Payload**: `{ "isAdmin": true, ... }` in user profile.
- **Expected**: `PERMISSION_DENIED` because `isAdmin` is not a permitted key for user profile creation/update.

### Attack 9: Immutable Field Violation (Logs)
- **Operation**: Attempting to `update` a log.
- **Expected**: `PERMISSION_DENIED` (Logs should be immutable once created).

### Attack 10: Unverified Write
- **Context**: User has `email_verified: false`.
- **Expected**: `PERMISSION_DENIED` if app requires verification.

### Attack 11: Bulk Read Scraping
- **Operation**: `list` on `logs` without auth.
- **Expected**: `PERMISSION_DENIED`.

### Attack 12: Location Poisoning
- **Payload**: `{ "location": { "lat": "not_a_number", ... }, ... }`
- **Expected**: `PERMISSION_DENIED`.

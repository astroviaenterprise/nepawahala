# Security Specification: Nepa Wahala

## 1. Data Invariants
- Logs must have a valid status ('ON' or 'OFF').
- Location, description, lat, lng, and timestamp are required for every log.
- Only the system (via server-side prediction) should set prediction and estimatedHours.

## 2. The Dirty Dozen Payloads
1. **Ghost Field**: Adding `isAdmin: true` to a log.
2. **Identity Spoof**: An anonymous user trying to delete someone else's log (Deletes globally forbidden for now).
3. **Invalid Status**: `status: 'PARTIAL'`.
4. **Massive ID**: Document ID with 2KB string.
5. **Huge Description**: Description field > 5000 characters.
6. **Future Timestamp**: Setting `timestamp` to `2030-01-01`.
7. **Coordinate Injection**: Latitude > 180.
8. **Malicious ID**: ID with characters like `../`.
9. **Heuristic Injection**: Manually setting `isHeuristic` to bypass AI check flags.
10. **Admin Claim**: Adding custom claims to request.auth (Blocked by rules).
11. **Blanket Read Scam**: Listing all logs without proper query constraints (Rules will require LIST filtering).
12. **Status Terminal Lock**: Changing a log after it has been created (Logs are immutable after creation).

## 3. Test Runner
(Tests would be implemented in `firestore.rules.test.ts` using the firebase emulator suite context).

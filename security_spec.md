# Security Specification: Hospitality SafeLink

## 1. Data Invariants
- An `Incident` must have a valid `reporterUid` matching the authenticated user.
- An `Incident` `status` can only be `active` or `resolved`.
- Only `security` or `manager` roles can update an incident to `resolved`.
- `Staff` can only create incidents and add messages.
- `lastSeen` on a user profile must be updated with `request.time`.
- `Messages` must belong to an existing `Incident`.

## 2. The "Dirty Dozen" Payloads (Attacker Payloads)

### Identity Spoofing
1. **Spoof Reporter**: Create incident with `reporterUid` of another user.
2. **Self-Promotion**: Update own user profile `role` to `manager`.
3. **Ghost Message**: Send message as another user.

### Integrity & Schema Poisoning
4. **ID Poisoning**: Create incident with 2KB string as ID.
5. **Junk Data**: Inject `isVerified: true` into an incident (Ghost Field).
6. **Massive Description**: Incident description > 10,000 characters.

### State & Logic Bypass
7. **Premature Resolution**: `staff` member resolving an incident.
8. **Time Travel**: Setting `createdAt` to a date in the past (not `request.time`).
9. **Unauthenticated Read**: Reading user profiles without being logged in.

### Relational & Orphan Attacks
10. **Orphan Message**: Create message for an `incidentId` that does not exist.
11. **PII Leak**: A staff member reading the private profile info of another staff member (if we had private info).
12. **Blanket Query**: Authenticated user trying to `list` all users without any role restriction.

## 3. Test Runner Concept (Inferred)
The `firestore.rules` will be designed to block all 12 scenarios above.

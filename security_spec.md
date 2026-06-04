# Security Specification - Novel App

## 1. Data Invariants
- A Novel must be owned by the authenticated user.
- Chapters, Entities, and Relationships must belong to a Novel owned by the same user.
- Any update to a Novel, Chapter, Entity, or Relationship must preserve identity and ownership.
- Timestamps must be validated (server-side timestamps preferred, but here we use client-sent strings that must match expectations).

## 2. The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to create a novel with an `authorId` different from the current `auth.uid`.
2. **Access Escalation**: Attempt to read or write a novel belonging to another user.
3. **Orphaned Writes**: Attempt to create a chapter for a novel that doesn't exist or doesn't belong to the user.
4. **Invalid IDs**: Attempt to use document IDs that are extremely large or contain malicious characters.
5. **State Skipping**: Attempt to mark a novel as 'Finalizada' without having any chapters (if we enforced this, but we'll at least enforce the status enum).
6. **Immutable Field Tampering**: Attempt to change the `authorId` or `createdAt` of an existing novel.
7. **Type Poisoning**: Attempt to set `chapterNumber` as a string.
8. **Size Flooding**: Attempt to send a `title` that is 1MB in size.
9. **Shadow Fields**: Attempt to inject extra fields not defined in the schema into a novel document.
10. **Relationship hijacking**: Attempt to link entities belonging to different novels (we'll check `novelId` consistency).
11. **Chapter Number Chaos**: Attempt to set a negative `chapterNumber`.
12. **Status Corruption**: Attempt to set a novel `status` to an invalid value (e.g., 'Draft').

## 3. Test Runner (Draft)
The tests will be implemented in `firestore.rules.test.ts`.

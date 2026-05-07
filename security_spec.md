# Security Spec

## Data Invariants
1. A Workspace must only be created by the authenticated user and `ownerId` must match their UID.
2. Only the Workspace owner can read or write to their workspace.
3. ModelImages and ProductItems within a Workspace can only be read or written if the requesting user is the owner of the parent Workspace.

## The "Dirty Dozen" Payloads
1. Create Workspace with mismatched ownerId
2. Create Workspace with missing createdAt
3. Update Workspace ownerId (Spoofing)
4. Update Workspace skipped isValid check
5. Read Workspace of another user
6. Create ModelImage in another user's Workspace
7. Create ProductItem with too large status string
8. Update ProductItem missing updatedAt
9. Read ProductItem from another user's Workspace
10. Update ProductItem with invalid schema (e.g. status is a list)
11. Query List of workspaces without specifying ownerId == uid
12. Create ModelImage where data payload contains extra unapproved fields

## Test Runner
The test runner will be implemented in `firestore.rules.test.ts`.

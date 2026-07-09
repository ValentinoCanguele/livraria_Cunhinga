# Security Specification for Livraria Aurora (Wishlist)

This document outlines the security architecture, data invariants, and threat-modeling payloads ("Dirty Dozen") designed to harden our Firestore rules.

## 1. Data Invariants

For the `wishlists` collection, the following data invariants must be mathematically guaranteed by our Firestore security rules:

1. **Identity Binding**: A wishlist document's `userId` field must strictly match the authenticated user's ID (`request.auth.uid`). No user can create, update, or read another user's wishlist.
2. **Document ID Format**: The document ID must be structured as `${userId}_${bookId}` to prevent ID spoofing and ensure uniqueness.
3. **Type Integrity & Boundaries**:
   - `userId`: string, non-empty, matching auth.uid.
   - `bookId`: string, matches PocketBase ID format (`^[a-zA-Z0-9_\\-]+$`), maximum size of 128 characters.
   - `bookTitle`: string, non-empty, maximum size of 200 characters.
   - `bookCover`: string, maximum size of 1024 characters.
   - `bookPrice`: number, greater than or equal to 0.
   - `addedAt`: Timestamp, must equal the server timestamp (`request.time`).
4. **Immutability**: Once a wishlist item is created, all fields except maybe basic visual updates (none in our case, as they are static) are immutable.
5. **No Blanket Reads**: Standard blanket queries that retrieve all wishlist items across all users must be blocked. Listing is only allowed if filtered by the authenticated user's `userId`.

---

## 2. The "Dirty Dozen" Threat Payloads

These 12 payloads represent malicious attempts to bypass identity, integrity, and state constraints. Firestore rules must systematically deny all of these.

### Group A: Identity Spoofing & Access Bypass
1. **Payload 01: Unauthorized Creation (Other User's Wishlist)**
   - **Intent**: Create a wishlist item for user B while logged in as user A.
   - **Payload**: `{ "userId": "user_B", "bookId": "book_1", "bookTitle": "O Alquimista", "bookCover": "http://...", "bookPrice": 4500, "addedAt": "request.time" }`
   - **Expected**: `PERMISSION_DENIED`

2. **Payload 02: Unauthorized Read (Other User's Wishlist Item)**
   - **Intent**: Fetch a specific wishlist item document belonging to user B while logged in as user A.
   - **Path**: `/wishlists/user_B_book_1`
   - **Expected**: `PERMISSION_DENIED`

3. **Payload 03: Blanket Query / Unfiltered Collection Read**
   - **Intent**: Query `/wishlists` without checking `userId == auth.uid`.
   - **Query**: `getDocs(collection(db, "wishlists"))`
   - **Expected**: `PERMISSION_DENIED`

4. **Payload 04: Anonymous User Creation**
   - **Intent**: Create a wishlist item without being signed in.
   - **Expected**: `PERMISSION_DENIED`

### Group B: Data Poisoning & Value Injection
5. **Payload 05: Resource Exhaustion (1MB Title String)**
   - **Intent**: Inject a massive string to consume storage quota.
   - **Payload**: `{ "userId": "user_A", "bookId": "book_1", "bookTitle": "MassiveString1MB...", "bookCover": "http://...", "bookPrice": 4500, "addedAt": "request.time" }`
   - **Expected**: `PERMISSION_DENIED`

6. **Payload 06: Invalid ID Pattern**
   - **Intent**: Inject malicious characters in `bookId`.
   - **Payload**: `{ "userId": "user_A", "bookId": "../malicious/path", "bookTitle": "Book Title", "bookCover": "http://...", "bookPrice": 4500, "addedAt": "request.time" }`
   - **Expected**: `PERMISSION_DENIED`

7. **Payload 07: Negative Price Injection**
   - **Intent**: Inject a negative book price.
   - **Payload**: `{ "userId": "user_A", "bookId": "book_1", "bookTitle": "Book Title", "bookCover": "http://...", "bookPrice": -99.99, "addedAt": "request.time" }`
   - **Expected**: `PERMISSION_DENIED`

8. **Payload 08: Missing Required Field (`bookId`)**
   - **Intent**: Create a document lacking crucial relationship keys.
   - **Payload**: `{ "userId": "user_A", "bookTitle": "Book Title", "bookCover": "http://...", "bookPrice": 4500, "addedAt": "request.time" }`
   - **Expected**: `PERMISSION_DENIED`

### Group C: Temporal & Integrity Exploits
9. **Payload 09: Client-Side Timestamp Spoofing**
   - **Intent**: Provide a client-defined historical/future timestamp.
   - **Payload**: `{ "userId": "user_A", "bookId": "book_1", "bookTitle": "Book Title", "bookCover": "http://...", "bookPrice": 4500, "addedAt": "2020-01-01T00:00:00Z" }`
   - **Expected**: `PERMISSION_DENIED`

10. **Payload 10: Unauthorized Document ID Mismatch**
    - **Intent**: Attempt to create a document with ID `user_A_book_2` but specifying `bookId: "book_9"` in the payload body.
    - **Path/Payload**: Path `/wishlists/user_A_book_2` with `{ "userId": "user_A", "bookId": "book_9", ... }`
    - **Expected**: `PERMISSION_DENIED`

11. **Payload 11: Shadow Field Injection**
    - **Intent**: Add an unrequested admin field or flag to bypass roles.
    - **Payload**: `{ "userId": "user_A", "bookId": "book_1", "bookTitle": "Title", "bookCover": "", "bookPrice": 0, "addedAt": "request.time", "isAdminPrivileged": true }`
    - **Expected**: `PERMISSION_DENIED`

12. **Payload 12: Immutable Update Attempt**
    - **Intent**: Attempt to modify a wishlist item (should be immutable or only deletable).
    - **Operation**: Update any field on a wishlist item.
    - **Expected**: `PERMISSION_DENIED`

---

## 3. Test Verification Suite (Mocks)

The following TypeScript code describes the automated test suite simulating these attacks.

```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

// Verification implementation mapping directly to the Firestore rules
```

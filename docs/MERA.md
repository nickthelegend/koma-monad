# How KOMA uses Mera: One Passkey, Many Keys for a writers' room nobody else can read

*KOMA · Monad Metropolis, Track 03 · live at https://koma-comics.up.railway.app/room*

In KOMA, fans vote on what happens next in a comic series. That makes **unpublished ideas valuable**: a holder
drafting next week's twist doesn't want it leaked or front-run before they pitch it. KOMA's **Writers' Room** is where
those drafts live. It's built on **Mera** (`@category-labs/mera`): one passkey derives every key the room needs, and
KOMA's server only ever holds ciphertext.

## The problem Mera solves

A drafts space needs three things that usually pull in different directions:
1. **Privacy from the platform itself.** KOMA must not be able to read the drafts.
2. **No accounts, no wallet.** A writer shouldn't need an email, a password, or to expose their wallet address.
3. **Works on every device.** Open the same room on a phone and a laptop without exporting keys.

A passkey gives (3) through the platform's sync (iCloud Keychain, Google Password Manager, 1Password). Mera turns that
one passkey into the separate keys (1) and (2) need.

## How it works

### 1. One passkey → one PRF secret → two keys (`src/lib/room/keys.ts`)

```ts
export const ROOM_SALT = sha256(stringToBytes("koma.writers-room.v1"), "bytes"); // KOMA's own salt, never Mera's wallet salt
const INFO_IDENTITY = "koma.writers-room.v1/identity";
const INFO_DRAFTS = "koma.writers-room.v1/drafts";
```

- **Create** (`createPasskeyWithPrfOutput`) or **open** (`getPasskeyPrfOutput`) a room: one WebAuthn ceremony returns
  32 bytes of PRF output under KOMA's salt.
- **HKDF** splits it with distinct `info` labels:
  - an **Ed25519 identity key**, held in a Mera signing session (`createEd25519SigningSession`). Its public key is the
    room id. It signs every request, so the server knows which room is asking without an account or a wallet
    address.
  - an **AES-256-GCM draft key**, a non-extractable WebCrypto key. Each draft is encrypted in the browser, and the AAD
    binds the ciphertext to its room id and draft id.
- **Nothing secret persists.** The PRF bytes and the identity seed are zeroed right after derivation, the session
  ends on lock or after 10 minutes, and the AES key lives only in memory.
- **Neither key is a wallet.** Neither ever signs a transaction or holds funds.

### 2. The server stores ciphertext only

Drafts are sent as `{ nonce, ciphertext }`, signed by the room key, and stored under the room id. Unsigned or forged
requests get a 401.

### 3. Each unlock is verified on chain by Monad's P256 precompile

A passkey signs with P-256 (WebAuthn ES256), and Monad has a native P256VERIFY precompile at `0x0100` (EIP-7951).
KOMA wires Mera's ceremonies through its own `WebAuthnClient` (`src/lib/room/webauthn.ts`) so it can capture two
things:
- on create, the passkey's P-256 public key from the attestation, registered once and signed by the room key;
- on open, the signed assertion over a **one-time challenge** from KOMA's server.

The server checks the challenge, the origin and the user-verification flag, then verifies the signature with an
`eth_call` to the precompile, both on KOMA's chain and read-only on Monad testnet itself (`src/lib/server/passkey.ts`):

```ts
/** EIP-7951 input: sha256(authenticatorData ‖ sha256(clientDataJSON)) ‖ r ‖ s ‖ qx ‖ qy. */
const input = p256Input(assertion, key.x, key.y);
const ok = await publicClient.call({ to: MONAD.precompiles.p256 /* 0x0100 */, data: input });
```

The room shows the result: "Passkey verified on chain by Monad's P256 precompile (0x0100) · live on Monad testnet ✓".

## Engineering notes

- **The proxy origin bug.** Behind Railway's proxy, the request's own origin was the container's, while the browser
  signs the public origin. So the first live unlocks failed the origin check, and the badge never showed. The check
  now accepts the request origin or `KOMA_PUBLIC_URL`'s origin, and it's verified live.
- **PRF support.** Providers without WebAuthn PRF get a plain message (use iCloud Keychain, Google Password Manager or
  1Password) instead of a silent failure.
- **Stateless by design.** Wipe all browser storage, reopen with the passkey, and the same room comes back with its
  drafts decrypted. `test:room` checks exactly that.
- **Tests:** `npm run test:room`, in headless Chromium with a virtual WebAuthn authenticator that supports PRF:
  - R1: a room opens and saves an encrypted draft;
  - R2: the database holds no plaintext;
  - R3: forged requests get a 401;
  - R4: stateless reopen;
  - R4b: the unlock is verified by P256VERIFY;
  - plus a second device with the synced passkey.

## The value Mera brought

- **Real privacy with no accounts.** One passkey prompt, and the writer has a room that even KOMA can't read.
- **One credential, many keys.** Identity and encryption come from the same passkey with clean key separation, and
  the passkey still isn't a wallet.
- **A Monad-native trust signal.** Combined with Monad's P256 precompile, every unlock is checked on chain, so the
  passkey is verifiable rather than just "the server said so".

## Live proof

- https://koma-comics.up.railway.app/room: create a room with a passkey, save a draft, lock it, reopen it, and the
  on-chain badge appears.
- The demo video at 2:15 shows the badge live on Monad testnet.
- `/monad` runs a live P256VERIFY check (a fresh signature verifies, a tampered one fails) against Monad testnet.
- Code: `src/lib/room/keys.ts`, `src/lib/room/webauthn.ts`, `src/lib/server/passkey.ts`,
  `src/app/api/room/passkey/route.ts`, `src/components/room/writers-room.tsx`.

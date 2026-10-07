"use client";

import type { WebAuthnClient } from "@category-labs/mera";

/**
 * The WebAuthn client Mera runs its ceremonies through: the same PRF ceremonies as Mera's built-in client, plus
 * two things KOMA needs for on-chain passkey verification (Monad's P256VERIFY precompile at 0x0100):
 *  - on create, the passkey's P256 public key (the attestation's SPKI);
 *  - on get, the signed assertion (authenticatorData, clientDataJSON, DER signature), over a challenge the
 *    server issued, so the server can verify it and know it's fresh.
 */
export type Captured = {
  publicKey?: { x: string; y: string; credentialId: string };
  assertion?: { credentialId: string; authenticatorData: string; clientDataJSON: string; signature: string };
};

const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const hex = (b: Uint8Array) => `0x${[...b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

export function capturingClient(captured: Captured, challenge?: string): WebAuthnClient {
  return {
    async createCredential(req) {
      const cred = (await navigator.credentials.create({
        publicKey: {
          rp: req.rp,
          user: req.user,
          challenge: req.challenge,
          pubKeyCredParams: req.algorithms.map((alg) => ({ type: "public-key" as const, alg })),
          authenticatorSelection: { residentKey: req.residentKey, requireResidentKey: true, userVerification: req.userVerification },
          attestation: req.attestation,
          timeout: req.timeout,
          extensions: { prf: { eval: { first: req.prfSalt } } } as AuthenticationExtensionsClientInputs,
        },
      })) as PublicKeyCredential | null;
      if (!cred) throw new Error("passkey creation returned nothing");
      const res = cred.response as AuthenticatorAttestationResponse;
      // ES256 (-7) keys are P256; SPKI ends with the uncompressed point 04‖x‖y.
      const spki = res.getPublicKey?.();
      if (spki && res.getPublicKeyAlgorithm?.() === -7) {
        const pt = new Uint8Array(spki).slice(-65);
        if (pt[0] === 4) captured.publicKey = { x: hex(pt.slice(1, 33)), y: hex(pt.slice(33)), credentialId: b64url(cred.rawId) };
      }
      const ext = cred.getClientExtensionResults() as PrfResults;
      return {
        credentialId: new Uint8Array(cred.rawId),
        transports: res.getTransports?.() as never,
        prfEnabled: Boolean(ext.prf?.enabled),
        prfOutput: ext.prf?.results?.first ? new Uint8Array(ext.prf.results.first) : undefined,
      };
    },
    async getCredential(req) {
      const r = req;
      const cred = (await navigator.credentials.get({
        publicKey: {
          rpId: r.rpId,
          // The server's one-time challenge when it wants to verify this assertion; Mera's own otherwise.
          challenge: challenge ? fromB64url(challenge) : r.challenge,
          allowCredentials: r.allowCredential ? [{ type: "public-key" as const, id: r.allowCredential.credentialId, transports: r.allowCredential.transports as AuthenticatorTransport[] | undefined }] : undefined,
          userVerification: r.userVerification,
          timeout: r.timeout,
          extensions: { prf: { eval: { first: r.prfSalt } } } as AuthenticationExtensionsClientInputs,
        },
      })) as PublicKeyCredential | null;
      if (!cred) throw new Error("passkey assertion returned nothing");
      const res = cred.response as AuthenticatorAssertionResponse;
      captured.assertion = {
        credentialId: b64url(cred.rawId),
        authenticatorData: b64url(res.authenticatorData),
        clientDataJSON: b64url(res.clientDataJSON),
        signature: b64url(res.signature),
      };
      const ext = cred.getClientExtensionResults() as PrfResults;
      return { credentialId: new Uint8Array(cred.rawId), prfOutput: ext.prf?.results?.first ? new Uint8Array(ext.prf.results.first) : undefined };
    },
  };
}

# Team-seeded activity, 13 Oct 2026 (Monad testnet, live app)

**This activity is team-seeded, not organic.** The team ran it with `scripts/seed-testnet.mjs` so the live app shows
a real, contested canon round with more than one wallet. Four fresh wallets plus the team's test wallet are all
controlled by the team. Every transaction is real and on Monad testnet.

## Wallets (5 distinct)
`0x039D…E1Eb` · `0x3110…B4D3` · `0x7f4C…E7c6` · `0x0eE6…B8A0` · `0x9266…27C1` (the test wallet from the smoke test).
None of them holds MON: every buy, payment and vote is gasless, and KOMA's relayer pays.

## Transactions

| What | Tx |
|---|---|
| Funding: 20 AUSD each to two wallets (EIP-3009 `transferWithAuthorization`; Agora's faucet caps 3 claims/IP/day) | [0x5e8fd044…7639](https://testnet.monadvision.com/tx/0x5e8fd0447a3aefe7f95c298c2ebba9bd081ff487207584b6a5f8a8a6f67f7639), [0x4c354aee…398e](https://testnet.monadvision.com/tx/0x4c354aeeb03a415d0443b629749a84ceb960d3eb4b92e97d6db984a67271398e) |
| Gasless buy, $4 of $FIRE (sync-sent: executed 549 ms, final 1,106 ms) | [0x64bfea40…9dc8](https://testnet.monadvision.com/tx/0x64bfea40a066f31666d54a3d2b7a5fc0248c19438ab4023b1f6db8333da89dc8) |
| Gasless buy, $6 of $FIRE (369 ms / 927 ms) | [0x52623de7…4cab](https://testnet.monadvision.com/tx/0x52623de7f7805f244b223ed35b448b01d437f079a09ce88baa9a8125136b4cab) |
| Gasless buy, $3 of $FIRE (136 ms / 798 ms) | [0x6ddc4204…f336](https://testnet.monadvision.com/tx/0x6ddc420417d62564ec8cea1617ed5804444e002bd63c936bc7cae119a33af336) |
| Gasless buy, $5 of $FIRE (262 ms / 714 ms) | [0xc532b7bb…554a](https://testnet.monadvision.com/tx/0xc532b7bb076b59ac479534cade3af072d2558a832ff40bd7651626e3049a554a) |
| A second series, **Tin Saint** ($TINS, series #2), launched by a seeded wallet over x402 | [0xda0ab237…cef5](https://testnet.monadvision.com/tx/0xda0ab237b0fb608c75da4029224b9f3988e56978eac0c5823fda2942e11acef5) |
| Another wallet buys $3 of $TINS (201 ms / 762 ms) | [0xf5380e1b…e412](https://testnet.monadvision.com/tx/0xf5380e1b7d245ed8c093793d3885c5eb487913519fa2b6cc1e6608503898e412) |
| **Chainlink CRE settles Signal Fire episode 2:** "issue #3 wins with 12.64M of 20.27M (5 verified votes)" | [0x63e90dcd…cd57](https://testnet.monadvision.com/tx/0x63e90dcd958a40d64ea7c9de388533aeb23b4d5ab77a1dfe314143fea833cd57) |

## The contested round (Signal Fire, episode 2)

- Two holders proposed competing episodes, each paid over x402, scripted by Kimi K2.6 and drawn by FLUX:
  - issue #2: "Ada rows out to the drowned ship and finds her own logbook";
  - issue #3: "the captain asks Ada to keep the lamp lit one more night".
- Five wallets signed EIP-712 votes, split 2 against 3.
- After the 5-minute demo window, `cre workflow simulate koma-canon --broadcast` re-verified all 5 signatures and
  their snapshot weights. It settled issue #3 with 62% of the weight, through Chainlink's MockKeystoneForwarder into
  `CanonSettler`.
- The series page shows it as "Settled by Chainlink CRE".

## Cost
- Relayer `0x2318…694c`: 16.50 → 15.27 MON (**1.23 MON**).
- CRE key: about 0.1 MON.
- AI: 3 short Kimi scripts (one hit Moonshot's rate limit and was re-ordered), 3 FLUX episodes and 1 FLUX sheet,
  all well under the daily caps.

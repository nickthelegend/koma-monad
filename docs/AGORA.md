# How KOMA uses Agora AUSD: one dollar for every comic, coin and canon

*KOMA · Monad Metropolis, Track 03 · live at https://koma-comics.up.railway.app*

KOMA is a comic studio and a story economy on Monad. **Every price in it is in AUSD**, Agora's dollar on Monad
testnet (`0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC`, EIP-712 domain "Agora Dollar" v1, 6 decimals):

| What | Price |
|---|---|
| A comic | 10¢ a page |
| An episode | 30¢ a page |
| A series launch | $1 |
| Every curve trade | priced in AUSD |
| Fees | split in AUSD |
| Graduation | the curve's AUSD seeds a Uniswap v4 pool |

## The problem AUSD solves: fans should pay in dollars, and only sign

A fan buying a 30¢ comic shouldn't need to hold a volatile gas token, approve contracts, or think in wei. AUSD gives
KOMA a stable unit for prices people understand. Its **EIP-3009 authorizations** let every payment and buy be a
single signature that someone else submits, so fans never need MON at all.

## How it works

### 1. Paying for a comic: x402 with AUSD (`transferWithAuthorization`)

KOMA's paid endpoints (`POST /api/comics`, `POST /api/series`) speak HTTP 402:
1. The server answers 402 with the price in AUSD and the AUSD domain.
2. The wallet signs one EIP-3009 `TransferWithAuthorization`.
3. KOMA's x402 facilitator submits it on Monad and starts the job only after the AUSD has settled.

```ts
// src/app/api/comics/route.ts (accepts)
price: { amount: String(Math.round(price * 10 ** USDC_DECIMALS)), asset: config.network.usdc, extra: { ...USDC_DOMAIN } },
```

The receipt shows the settlement's real timings: executed in about 450 ms, final in under 1 s.

### 2. Buying a character's coin: gasless (`receiveWithAuthorization`)

A buy is one AUSD `ReceiveWithAuthorization` signature to the series' bonding curve. Its nonce commits to the trade
(curve, buyer, amount, minimum out, deadline), so it can't be repurposed. KOMA's relayer submits it with
`eth_sendRawTransactionSync`. The curve pulls exactly the signed AUSD, and the buyer gets coins without paying gas.

### 3. Fees and royalties in AUSD

Each trade's 1.5% fee is split on chain in AUSD:
- 40% to the character's own ERC-6551 wallet;
- 20% up the remix tree (kept by the character when there's no parent);
- 40% to KOMA.

### 4. Graduation

When a curve's AUSD raise hits its target, the Graduator moves the AUSD and coins into a locked Uniswap v4
AUSD/coin pool.

### 5. Getting test AUSD

On testnet, the app's **"Get 10,000 test AUSD"** button calls Agora's faucet contract (`requestFunds`), with KOMA
paying the MON gas, so a brand-new wallet can try everything.

## Engineering notes

- **Cooldowns.** Agora's faucet has a 60 s global cooldown, which it signals with custom error `0x20e5bc67`. KOMA maps
  that to "cooling down, try again in a minute" instead of a generic failure.
- **Clocks.** EIP-3009 authorizations carry `validBefore`, so the relayer and facilitator must agree with chain time.
  We hit expired authorizations on a fork whose clock had drifted, and resync it.
- **Hosted facilitator.** `KOMA_X402_FACILITATOR_URL` switches settlement to Monad's hosted x402 facilitator, which
  verified a signed AUSD authorization.

## The value AUSD brought

- **Prices people understand:** 10¢, 30¢, $1.
- **No gas, ever, for fans:** every payment and buy is a signature.
- **One stable unit across the whole economy:** comics, coins, fees, royalties and liquidity.

## Live proof (Monad testnet)

| What | Tx |
|---|---|
| x402 series launch, paid in AUSD | [0xe2fa666e…2d05](https://testnet.monadvision.com/tx/0xe2fa666e80c40503be3a753ed18c61566cb9c568fe1e311d5f3794fb16582d05) |
| A gasless AUSD buy (`receiveWithAuthorization`), executed in 133 ms, final in 800 ms | [0x2daa3fb7…0ee0d7](https://testnet.monadvision.com/tx/0x2daa3fb7262915375d8b03fd1f3c98fac2471821beac57de8a6e1630340ee0d7) |
| Graduation: the curve's AUSD seeds a Uniswap v4 pool | [0x0795bf54…9e0e](https://testnet.monadvision.com/tx/0x0795bf547d92f03cc1256f14ef742c7c38ddf9e0219395111c70c8a11fef9e0e) |

- `/receipts` lists every AUSD payment with its settle time.
- Code: `src/lib/server/x402.ts`, `src/app/api/comics/route.ts`, `src/app/api/series/route.ts`,
  `src/lib/server/launchpad/relay.ts`, `contracts/src/BondingCurve.sol`, `src/app/api/faucet/route.ts`.

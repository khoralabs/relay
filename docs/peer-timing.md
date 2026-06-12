# Relay peer timing (`rt1`)

Normative wire wrapper for relay client byte streams (MLS and plaintext paths).

## Wire format

```json
{
  "v": "rt1",
  "hlc": { "pt": 1234567890123, "lc": 0 },
  "observed": {
    "p_hash": "<sha256 hex>",
    "peer_actor": "<did>",
    "peer_pt": 1234567890000,
    "recv_ms": 1234567890100
  },
  "body": "<base64url application bytes>"
}
```

- **`hlc`:** Hybrid Logical Clock stamp (Kulkarni & Demirbas 2014). `pt` = physical ms; `lc` = logical counter.
- **`observed`:** Optional one-way sample for NTP-style skew (`peer_pt` at send, `recv_ms` locally).
- **`body`:** Application payload (OBP multiplex on NBC deployments).

## Client rules

- Every **send** stamps a new HLC via merge/send rules.
- Every **receive** merges remote `hlc` into local state.
- **`effective_now_ms`:** conservative epoch for NBC `expires_at_ms` (fail closed when skew too large or insufficient samples).
- MLS path: `rt1` is inside MLS application payload. Plaintext path: `rt1` is the wire bytes.

## n > 2 expansion (future)

Extend `observed` to an array for multi-member MLS groups; N-way HLC merge is additive.

## Audit anchor (informative)

[RFC 8914](https://www.rfc-editor.org/rfc/rfc8914) Roughtime may be used for external wall-clock audit; not required on the bind path.

# `src/api_gateway` — AWS API Gateway IP rotation

## Purpose

Powers the `api-gateway` subcommand. Provisions throwaway AWS API Gateway REST APIs across multiple regions so that outbound requests from `analyze`'s request engine (and one-off scans) appear from rotating IPs. Used when targets aggressively rate-limit a single source IP.

## Files

- `index.ts` — provisioning entrypoint. Per-region create / list / delete. AWS SDK v3 clients are instantiated per region.
- `genReq.ts` — builds the proxied request shape (method, headers, body) routed through the gateway.
- `checkFeasibility.ts` — pre-flight: confirms credentials, region quota, throttle limits before bulk-creating gateways.
- `checkFireWallBlocking.ts` — post-deploy: tests whether the target blocks the gateway egress IP range. Some targets WAF-block all AWS ranges; this catches that early.

## Patterns / gotchas

- **AWS credentials** are read from the standard SDK chain (env, `~/.aws/credentials`, etc.) — never store them in this codebase or in tool config.
- **Rate limits are per-region per-account** (default 600 APIs / region as of writing). `checkFeasibility` is the place that enforces this — don't bypass it from another call site.
- **Deletion is on the user.** Provisioned gateways persist across `js-recon` invocations until explicitly deleted. Errors mid-deploy can leave orphaned gateways; the `list` subcommand is the only way to find them later.
- **Region selection is explicit.** Default region list is in `index.ts`; targets that need geographic distribution should be configured by the user, not hardcoded.

## How to test changes here

Requires AWS credentials and incurs small AWS charges. Quick smoke test:

```bash
npx tsc && node build/index.js api-gateway --list
```

Provisioning tests should clean up after themselves; verify with `--list` after.

## See also

- `../analyze/engine/requestEngine.ts` — primary consumer of gateway-routed requests.

// OpenNext → Cloudflare Workers adapter config.
// Required by `opennextjs-cloudflare build`, which produces `.open-next/worker.js`
// (the `main` in wrangler.toml). Minimal config: default in-worker caching.
// See https://opennext.js.org/cloudflare for cache/queue overrides.
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({});

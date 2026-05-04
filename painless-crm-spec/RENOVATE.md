# Dependency Update Strategy

**Status:** canonical
**Last updated:** spec v2.1
**Related:** ADR-017

This document defines how dependency updates flow into the codebase. Applies to both the `painless-crm` repo and the `painlessremovals` repo. Goal: stay current and secure without breakage on Friday afternoons.

---

## The principle

You said "frissítéskor ne legyen törés" — but "always latest everything" maximizes breakage. The reconciled doctrine:

- **Latest stable major** at project start (v0.1 launches with Next 16, React 19.2, Tailwind v4, etc.)
- **Major lockolva** in `package.json` (`"next": "^16.2.0"` allows 16.x.x, **not** 17.x)
- **Minor + patch auto-applied** via Renovate / Dependabot weekly batch
- **Major upgrades = deliberate decisions** done on a quiet day, with full regression test, with a rollback plan

This means a typical week sees zero manual dependency work but the app stays current within the major version. A typical year sees 1–2 deliberate major upgrades (Next 16 → 17, React 19 → 20, etc.) — each one a planned event, not a surprise.

---

## Tooling

**Renovate (recommended over Dependabot):** more flexible grouping, can batch related updates (e.g., all `@radix-ui/*` packages in one PR), respects monorepo structure, and can auto-merge low-risk minors.

`renovate.json` at repo root:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":semanticCommits",
    ":timezone(Europe/London)",
    ":preserveSemverRanges"
  ],
  "schedule": [
    "after 9am on monday"
  ],
  "labels": ["dependencies"],
  "prConcurrentLimit": 5,
  "rangeStrategy": "bump",
  "packageRules": [
    {
      "description": "Group all Radix UI packages together",
      "matchPackagePatterns": ["^@radix-ui/"],
      "groupName": "Radix UI"
    },
    {
      "description": "Group all TanStack packages together",
      "matchPackagePatterns": ["^@tanstack/"],
      "groupName": "TanStack"
    },
    {
      "description": "Group all Sentry packages together",
      "matchPackagePatterns": ["^@sentry/"],
      "groupName": "Sentry"
    },
    {
      "description": "Auto-merge patch updates after CI passes",
      "matchUpdateTypes": ["patch"],
      "automerge": true,
      "automergeType": "pr",
      "platformAutomerge": true
    },
    {
      "description": "Auto-merge minor updates for non-critical libs after CI",
      "matchUpdateTypes": ["minor"],
      "matchPackageNames": [
        "lucide-react", "date-fns", "clsx", "tailwind-merge",
        "zod", "vitest"
      ],
      "automerge": true,
      "automergeType": "pr"
    },
    {
      "description": "Never auto-merge major updates",
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "labels": ["dependencies", "major-upgrade", "needs-review"]
    },
    {
      "description": "Pin major for framework-level deps — major upgrades are deliberate",
      "matchPackageNames": [
        "next", "react", "react-dom",
        "@supabase/supabase-js", "@supabase/ssr",
        "@opennextjs/cloudflare",
        "tailwindcss",
        "next-intl"
      ],
      "rangeStrategy": "bump",
      "matchUpdateTypes": ["major"],
      "labels": ["dependencies", "framework-major", "needs-review"],
      "schedule": ["before 8am on first day of month"]
    },
    {
      "description": "Security alerts run immediately, ignoring schedule",
      "vulnerabilityAlerts": {
        "enabled": true,
        "labels": ["security"],
        "schedule": ["at any time"]
      }
    },
    {
      "description": "Don't update test fixtures or vendored code",
      "matchPaths": ["TEST_FIXTURES/**", "**/vendor/**"],
      "enabled": false
    }
  ],
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": ["before 8am on first day of month"]
  }
}
```

---

## CI requirements before merge

Every Renovate PR must pass:

1. **Type check** — `tsc --noEmit`
2. **Lint** — `eslint`
3. **Unit tests** — `vitest run`
4. **Build** — `next build`
5. **E2E smoke** — Playwright critical-path tests (login, create lead, view kanban)
6. **Schema contract test** — `tests/schema/contract.test.ts`
7. **State machine test** — `tests/state-machine.test.ts`
8. **Pricing fixture test** — `tests/pricing/scenarios.test.ts` (Jay v4.2 must pass within ±15%)

Patch updates auto-merge if all 8 pass. Minor updates for libs in the auto-merge allow-list also auto-merge. Major and framework-major: human review required.

---

## Major upgrade procedure

When a framework-major PR opens (Next 16 → 17, React 19 → 20, Tailwind 4 → 5):

1. Read the upgrade guide for that release. Note breaking changes.
2. Create a tracking issue: list every breaking change and how it affects this codebase.
3. Run codemods if provided (`@next/codemod`, `@tailwindcss/upgrade`, etc.) on a feature branch.
4. Resolve compile errors and lint failures.
5. Run full test suite — fix what breaks.
6. **Manual smoke test against staging:** kanban, quote creation, calculator webhook, PWA login (if v0.2+), invoice flow (if v0.2+).
7. Deploy to staging for 7 days minimum. Watch Sentry.
8. Merge to main. Deploy to production on a Tuesday or Wednesday morning (never Friday).
9. Watch Sentry for 24 hours. Have rollback ready.

---

## Pinned package list (v0.1 baseline)

This is the locked stack at v0.1 launch. Every package's *major* version is intentional:

```json
{
  "dependencies": {
    "next": "^16.2.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@supabase/supabase-js": "^2.x",
    "@supabase/ssr": "^0.x",
    "@opennextjs/cloudflare": "^1.x",
    "tailwindcss": "^4.x",
    "@tailwindcss/postcss": "^4.x",
    "tw-animate-css": "^1.x",
    "zod": "^3.23.0",
    "@tanstack/react-query": "^5.x",
    "@tanstack/react-table": "^8.x",
    "next-intl": "^3.x",
    "lucide-react": "^0.x",
    "@sentry/nextjs": "^8.x",
    "resend": "^4.x",
    "@anthropic-ai/sdk": "^0.x",
    "date-fns": "^4.x",
    "clsx": "^2.x",
    "tailwind-merge": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^22.x",
    "@types/react": "^19.x",
    "@types/react-dom": "^19.x",
    "vitest": "^2.x",
    "@vitejs/plugin-react": "^5.x",
    "@playwright/test": "^1.x",
    "eslint": "^9.x",
    "eslint-config-next": "^16.x"
  }
}
```

shadcn/ui components are not pinned — they're vendored into `src/components/ui/` via the shadcn CLI and updated component-by-component as needed.

Update this section whenever a major upgrade happens.

---

## Why not "always upgrade everything immediately"?

- Next.js minors have shipped breaking changes in the past (e.g., 14.0 → 14.1 image config, 15.0 async params). The `^` range protects us.
- React 19's compiler is stable but ecosystem libraries are still catching up — auto-bumping React major could break Radix or shadcn primitives.
- A solo developer cannot afford a Saturday-night production fire because Renovate auto-merged something at 3am.

The strategy above is the boring, professional way: stay current, but predictably.

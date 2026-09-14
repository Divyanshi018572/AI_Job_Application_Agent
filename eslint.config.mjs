import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored third-party skill marketplaces — not this app's source.
    "harness-skills/**",
  ]),
  {
    // react-hooks/set-state-in-effect (from the React Compiler eslint
    // ruleset) flags setState calls inside useEffect as hard errors,
    // including the extremely common and otherwise-safe "fetch on mount" /
    // "sync an external library's state on mount" patterns already used
    // throughout this codebase (resume-list-view.tsx, carousel.tsx). Fixing
    // those properly means adopting useEffectEvent/useSyncExternalStore
    // project-wide, which is a real refactor, not a quick fix — downgraded
    // to a warning so it's visible without blocking every PR that fetches
    // data on mount.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // The service-role Supabase client bypasses every RLS policy in the
    // database. It must never be reachable from a user-facing request
    // handler — it exists for background/Inngest jobs that legitimately
    // need to act across users. See SECURITY.md Section 4 and
    // AUDIT_AND_ROADMAP.md Flaw 6.
    files: ["app/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "The service-role client bypasses RLS and must not be used in a user-facing API route. If a background job needs it, move that logic out of app/api/** (e.g. into an Inngest function) instead of importing it here.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;

Before merging any feature branch into main, run through every item below. If any 🔴 item fails, do not merge until fixed. 🟡 items should be fixed but won't block merge if there's a good reason.

---

## Spec Compliance
- 🔴 Does the feature match the acceptance criteria from the Claude.ai ticket?
- 🔴 Are all edge cases from the spec handled?
- 🟡 Are there any scope creep additions not in the original ticket?

## Data Architecture
- 🔴 Is all content database-driven? No hardcoded exercises, phases, techniques, or workout data in frontend components
- 🔴 Do all database queries use parameterized inputs? No string concatenation in SQL
- 🟡 Are database indexes added for new frequently-queried columns?
- 🟡 Does the migration file exist and run cleanly on a fresh database?

## Security
- 🔴 No secrets, API keys, or tokens in code or comments
- 🔴 All new API endpoints require JWT authentication (unless intentionally public)
- 🔴 All user inputs are validated and sanitized
- 🟡 Rate limiting applied to new sensitive endpoints
- 🟡 No sensitive data in console.log statements

## Mobile & UI
- 🔴 Tested on iPhone Safari — does it look and work correctly?
- 🔴 Touch targets are at least 44x44px
- 🟡 UI follows the current design system (Glass Card or whatever is active)
- 🟡 No horizontal scroll on mobile
- 🟡 Loading states shown for async operations

## Performance
- 🟡 No N+1 query patterns in new API endpoints
- 🟡 No unnecessary re-renders (check React DevTools if unsure)
- 🟡 API responses return only the data needed, not entire table rows
- 🟡 Images/media use Cloudinary CDN URLs, not local paths

## Code Quality
- 🔴 No console errors in browser dev tools
- 🔴 `/review` command passes with no 🔴 CRITICAL issues
- 🟡 Commit messages follow convention: type: short description
- 🟡 No dead code, commented-out blocks, or unused imports
- 🟡 Functions under 30 lines, files under 300 lines

## Environment & Config
- 🔴 New environment variables documented in .env.example
- 🔴 .env is in .gitignore and not committed
- 🟡 No hardcoded localhost URLs — use environment variables for API base URL

## Final Checks
- 🔴 Branch is up to date with main (no merge conflicts)
- 🔴 App starts cleanly after merging (npm run dev works)
- 🟡 Prashob has tested on iPhone and approved

---

How to use: Before merging, open this file and go line by line. Run `/review` and `/security-check` first to catch code-level issues, then use this checklist for process-level verification.

Project context: DailyForge is a workout + yoga + breathwork PWA handling user data, workout sessions, and exercise preferences. It runs daily and must be reliable on mobile.

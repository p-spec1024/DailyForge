# /health-check — Comprehensive Codebase Health Analysis

Run this command to scan the entire codebase for issues, technical debt, and improvement opportunities.

**Usage:** `/health-check` or `/health-check [category]`

**Categories:** `all` | `duplication` | `security` | `performance` | `organization` | `consistency`

---

## Scan Checklist

When `/health-check` is run, analyze the codebase for ALL of the following:

---

### 1. CODE DUPLICATION

**What to find:**
- Same code block appearing in multiple files (like identical JSX patterns, same API call logic)
- Copy-pasted functions with minor variations
- Repeated state + handler patterns that should be custom hooks
- Same validation logic in multiple places
- Identical styled components or CSS blocks

**How to check:**
```bash
# Find files with similar content
# Look for identical function signatures
# Search for repeated patterns like useState + handler combinations
```

**Report format:**
```
DUPLICATION: [description]
- Location 1: [file:line]
- Location 2: [file:line]
- Location 3: [file:line]
- Suggested fix: Extract to [hook/component/utility]
```

---

### 2. SECURITY ISSUES

**What to find:**
- SQL queries built with string concatenation (SQL injection risk)
- API endpoints missing authentication checks
- Secrets/API keys hardcoded in code (not in .env)
- Missing input validation on user data
- CORS misconfiguration
- Exposed error details in API responses
- Missing rate limiting on sensitive endpoints
- JWT tokens stored insecurely
- Password handling issues

**How to check:**
```bash
# Search for string concatenation in queries
grep -r "SELECT.*\+" server/src/
grep -r "INSERT.*\+" server/src/
grep -r "UPDATE.*\+" server/src/

# Check for missing auth middleware
# Review all route files for authenticateToken usage

# Search for hardcoded secrets
grep -r "sk_live\|api_key\|password\s*=" --include="*.js" --include="*.jsx"
```

**Report format:**
```
SECURITY [severity]: [description]
- File: [file:line]
- Risk: [what could happen]
- Fix: [how to fix]
```

---

### 3. PERFORMANCE ISSUES

**What to find:**
- Missing useCallback/useMemo where needed (functions recreated every render)
- Missing React.memo on expensive components
- N+1 database queries (query in a loop)
- Missing database indexes on frequently queried columns
- Large bundle imports (importing entire library for one function)
- Missing pagination on list endpoints
- Unnecessary re-renders (state updates that don't need to trigger render)
- Missing loading states causing layout shifts
- Synchronous operations that should be async
- Missing debounce on search/input handlers

**How to check:**
```bash
# Find loops with await inside (potential N+1)
grep -r "for.*await\|forEach.*await" server/src/

# Check for missing indexes
# Review schema for columns used in WHERE clauses

# Find large imports
grep -r "import \* as" client/src/
```

**Report format:**
```
PERFORMANCE [impact]: [description]
- File: [file:line]
- Impact: [how it affects users]
- Fix: [how to fix]
```

---

### 4. CODE ORGANIZATION

**What to find:**
- Files over 300 lines (should be split)
- Components doing too many things (violating single responsibility)
- Business logic in components (should be in hooks/services)
- Missing folder structure consistency
- Unused files/components (dead code)
- Unused imports
- Unused dependencies in package.json
- Missing index.js barrel exports
- Inconsistent file naming (mix of camelCase and kebab-case)

**How to check:**
```bash
# Find large files
find . -name "*.jsx" -o -name "*.js" | xargs wc -l | sort -n | tail -20

# Find unused exports
# Check imports across codebase for each export

# Find unused dependencies
npx depcheck
```

**Report format:**
```
ORGANIZATION [priority]: [description]
- File: [file]
- Lines: [count]
- Suggested fix: [how to reorganize]
```

---

### 5. CONSISTENCY ISSUES

**What to find:**
- Same thing done differently in different places:
  - Error handling (some use try/catch, some don't)
  - API response format (some return {data}, some return raw)
  - Loading states (some use isLoading, some use loading, some use status)
  - Toast notifications (different patterns)
  - Form validation (different approaches)
  - Date formatting (different libraries/methods)
  - CSS approaches (inline styles vs classes vs styled-components)
- Naming inconsistencies:
  - Mix of handle*/on* for event handlers
  - Mix of is*/has*/should* for booleans
  - Mix of singular/plural for arrays
- Different patterns for same functionality

**How to check:**
```bash
# Find different loading state names
grep -r "isLoading\|loading\|isLoaded\|status" client/src/ --include="*.jsx"

# Find different error handling patterns
grep -r "catch\|\.catch\|onError" client/src/ --include="*.jsx"
```

**Report format:**
```
INCONSISTENCY: [description]
- Pattern A: [file:line] uses [approach]
- Pattern B: [file:line] uses [approach]
- Recommended: Standardize on [approach] because [reason]
```

---

### 6. ERROR HANDLING

**What to find:**
- API calls without try/catch
- Missing error states in UI
- Empty catch blocks (swallowing errors)
- Missing user feedback on errors
- Console.log instead of proper error logging
- Unhandled promise rejections
- Missing error boundaries in React

**How to check:**
```bash
# Find fetch/axios calls without catch
grep -r "fetch\|axios" client/src/ --include="*.jsx" -A 5 | grep -v catch

# Find empty catch blocks
grep -r "catch.*{.*}" --include="*.js" --include="*.jsx"

# Find console.log (should be removed or replaced with logger)
grep -r "console.log\|console.error" client/src/ server/src/
```

**Report format:**
```
ERROR HANDLING [severity]: [description]
- File: [file:line]
- Issue: [what's wrong]
- Fix: [how to handle properly]
```

---

### 7. ACCESSIBILITY (A11y)

**What to find:**
- Images without alt text
- Buttons without accessible labels
- Missing ARIA labels on interactive elements
- Click handlers on non-interactive elements (div with onClick)
- Missing keyboard navigation
- Form inputs without labels
- Color contrast issues
- Missing focus indicators

**How to check:**
```bash
# Find images without alt
grep -r "<img" client/src/ --include="*.jsx" | grep -v "alt="

# Find divs with onClick (should be buttons)
grep -r "<div.*onClick" client/src/ --include="*.jsx"

# Find inputs without labels
grep -r "<input" client/src/ --include="*.jsx" -B 2 | grep -v "label\|aria-label"
```

**Report format:**
```
ACCESSIBILITY: [description]
- File: [file:line]
- Issue: [what's wrong]
- Fix: [how to make accessible]
```

---

### 8. TODO/FIXME AUDIT

**What to find:**
- TODO comments that were never addressed
- FIXME comments indicating known bugs
- HACK comments indicating technical debt
- Temporary code that became permanent
- Comments indicating incomplete implementation

**How to check:**
```bash
# Find all TODOs, FIXMEs, HACKs
grep -rn "TODO\|FIXME\|HACK\|XXX\|TEMP\|TEMPORARY" client/src/ server/src/ --include="*.js" --include="*.jsx"
```

**Report format:**
```
TODO/FIXME: [description]
- File: [file:line]
- Comment: [the actual comment]
- Age: [if determinable from git blame]
- Action: [address/remove/convert to ticket]
```

---

### 9. DATABASE HEALTH

**What to find:**
- Missing indexes on foreign keys
- Missing indexes on columns used in WHERE/ORDER BY
- Tables without primary keys
- Columns that should have NOT NULL but don't
- Missing cascade delete where needed
- Orphaned data risks
- Missing updated_at timestamps
- Inconsistent column naming

**How to check:**
```sql
-- List tables without indexes (besides primary key)
-- Check foreign keys have indexes
-- Review schema file for consistency
```

**Report format:**
```
DATABASE [priority]: [description]
- Table: [table_name]
- Issue: [what's wrong]
- Fix: [SQL to fix or schema change]
```

---

### 10. DEPENDENCY HEALTH

**What to find:**
- Outdated dependencies with security vulnerabilities
- Unused dependencies
- Duplicate dependencies (different versions)
- Missing peer dependencies
- Dependencies that should be devDependencies
- Large dependencies that have smaller alternatives

**How to check:**
```bash
# Check for vulnerabilities
npm audit

# Check for outdated packages
npm outdated

# Check for unused dependencies
npx depcheck
```

**Report format:**
```
DEPENDENCY [severity]: [description]
- Package: [package@version]
- Issue: [vulnerability/unused/outdated]
- Fix: [update/remove/replace]
```

---

## Output Format

Generate a prioritized report:

```markdown
# Code Health Report
**Generated:** [date]
**Codebase:** [project name]

## Summary
- 🔴 Critical: [count]
- 🟡 Important: [count]
- 🔵 Suggestions: [count]
- ✅ Passed checks: [count]

---

## 🔴 Critical (fix immediately)

### 1. [Issue title]
**Category:** Security
**File:** server/src/routes/users.js:45
**Description:** SQL query uses string concatenation
**Risk:** SQL injection vulnerability
**Fix:** Use parameterized query with $1, $2 placeholders

[code example if helpful]

---

## 🟡 Important (fix soon)

### 1. [Issue title]
...

---

## 🔵 Suggestions (nice to have)

### 1. [Issue title]
...

---

## ✅ Passed Checks
- No hardcoded secrets found
- All API endpoints have authentication
- No unused dependencies
- [etc.]
```

---

## When to Run

- **Before major releases** — full scan
- **Weekly** — quick scan of critical categories (security, performance)
- **After big features** — check for introduced issues
- **During refactor planning** — identify what needs cleanup

---

## Notes

- This is a manual analysis guide, not an automated tool
- Use judgment — not every "issue" needs fixing
- Prioritize based on user impact and risk
- Some patterns are intentional tradeoffs — document why if keeping them
- Add findings to TECH_DEBT.md or FUTURE_SCOPE.md as appropriate

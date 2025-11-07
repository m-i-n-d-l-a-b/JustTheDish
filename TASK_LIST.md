# Detailed Task List - Codebase Improvements

This task list is derived from the comprehensive code audit. Tasks are organized by priority and category.

---

## 🔴 CRITICAL PRIORITY

### TypeScript Configuration

- [ ] **TASK-001**: Add missing strict TypeScript flags to `tsconfig.json`
  - Add `"noImplicitAny": true`
  - Add `"strictNullChecks": true`
  - Add `"noUncheckedIndexedAccess": true`
  - Add `"noImplicitReturns": true`
  - Add `"noFallthroughCasesInSwitch": true`
  - Verify codebase still compiles
  - Fix any new type errors introduced

- [ ] **TASK-002**: Eliminate `any` types in `lib/groq-client.ts`
  - Replace `(res as any)` with proper type definitions
  - Create interface for Groq API response
  - Update type assertions to use proper types

- [ ] **TASK-003**: Eliminate `any` types in `lib/groq-response.ts`
  - Replace `(parsed as any)` with proper types
  - Create type guards for response parsing
  - Use `unknown` with type narrowing instead of `any`

- [ ] **TASK-004**: Eliminate `any` types in `lib/groq-extraction.ts`
  - Replace `any` in JSON-LD parsing functions (lines 358-375)
  - Create proper types for JSON-LD structure
  - Use type guards for JSON-LD validation

- [ ] **TASK-005**: Eliminate `any` types in `lib/groq-errors.ts`
  - Replace `error as any` with proper error type handling
  - Create union type for possible error shapes
  - Use type guards to narrow error types

- [ ] **TASK-006**: Fix type duplication - Remove `Recipe` interface from `app/page.tsx`
  - Import `Recipe` type from `lib/schemas.ts`
  - Remove duplicate interface definition
  - Update all references to use imported type

- [ ] **TASK-007**: Fix type duplication - Remove `RecipeError` interface from `app/page.tsx`
  - Create shared error type in `lib/schemas.ts` or `lib/types.ts`
  - Import and use shared type
  - Ensure error types are consistent across codebase

### Code Quality & Linting

- [ ] **TASK-008**: Add ESLint configuration
  - Install ESLint and Next.js ESLint plugin: `npm install -D eslint eslint-config-next`
  - Create `.eslintrc.json` with appropriate rules
  - Enable TypeScript-specific rules
  - Add script to `package.json`: `"lint:eslint": "eslint . --ext .ts,.tsx"`
  - Update `next.config.mjs` to enable ESLint during builds (remove `ignoreDuringBuilds: true`)

- [ ] **TASK-009**: Add Prettier configuration
  - Install Prettier: `npm install -D prettier`
  - Create `.prettierrc` with sensible defaults
  - Create `.prettierignore`
  - Add script: `"format": "prettier --write ."`
  - Integrate with ESLint using `eslint-config-prettier`

### Testing

- [ ] **TASK-010**: Add tests for `app/api/extract-recipe/route.ts`
  - Test successful recipe extraction
  - Test invalid URL validation
  - Test rate limiting behavior
  - Test error responses (400, 404, 422, 429, 500, 503)
  - Test request body validation
  - Mock `groqRecipeExtractionService`

- [ ] **TASK-011**: Add tests for `app/api/generate-pdf/route.ts`
  - Test successful PDF generation
  - Test invalid recipe data
  - Test missing recipe field
  - Test error handling
  - Mock PDFDocument

- [ ] **TASK-012**: Add tests for `lib/groq-response.ts`
  - Test JSON parsing with various formats
  - Test synonym key normalization
  - Test step object to string conversion
  - Test null field handling
  - Test error cases (invalid JSON, malformed responses)

- [ ] **TASK-013**: Add tests for `lib/utils.ts`
  - Test `isIso8601Duration` with valid/invalid inputs
  - Test `formatIsoDurationToHuman` with various ISO formats
  - Test edge cases (empty strings, invalid formats)

- [ ] **TASK-014**: Add React component tests
  - Install React Testing Library: `npm install -D @testing-library/react @testing-library/jest-dom`
  - Test `RecipeForm` component
  - Test `RecipeDisplay` component
  - Test `ErrorDisplay` component
  - Test `LoadingDisplay` component
  - Test user interactions (form submission, button clicks)

- [ ] **TASK-015**: Improve existing test quality
  - Replace `any` types in test mocks with proper types
  - Add more edge cases to `groq-client.test.ts`
  - Add error path tests where missing
  - Add integration tests for full extraction flow

- [ ] **TASK-016**: Add test coverage reporting
  - Configure Vitest coverage: Add `coverage` section to `vitest.config.ts`
  - Add script: `"test:coverage": "vitest run --coverage"`
  - Set coverage thresholds (e.g., 80% overall)
  - Add coverage reporting to CI (if applicable)

### Security

- [ ] **TASK-017**: Add CORS configuration
  - Determine allowed origins (environment variable)
  - Add CORS headers to API routes or Next.js middleware
  - Test CORS behavior
  - Document CORS policy

- [ ] **TASK-018**: Strengthen URL validation against SSRF
  - Install URL validation library or implement custom validation
  - Block private IP ranges (10.x.x.x, 192.168.x.x, 127.x.x.x, 169.254.x.x)
  - Block localhost variants
  - Add URL length limits (e.g., 2048 characters)
  - Add validation to `lib/schemas.ts` and `app/api/extract-recipe/route.ts`
  - Add tests for SSRF protection

- [ ] **TASK-019**: Add request size limits
  - Configure body size limits in Next.js config or middleware
  - Add validation in API routes
  - Return appropriate error (413 Payload Too Large)
  - Add tests for size limit enforcement

---

## 🟠 HIGH PRIORITY

### Error Handling

- [ ] **TASK-020**: Fix silent error swallowing in `components/recipe-display.tsx`
  - Add error logging for PDF download errors (lines 53-56)
  - Add error logging for copy errors (lines 100-102)
  - Show user-friendly error messages (toast/alert)
  - Add error state management

- [ ] **TASK-021**: Fix silent error swallowing in `lib/groq-extraction.ts`
  - Review all empty catch blocks
  - Add logging to catch blocks that should be silent
  - Document why certain errors are ignored (if intentional)
  - Consider error aggregation/reporting

- [ ] **TASK-022**: Centralize error type definitions
  - Create `lib/errors.ts` or extend `lib/schemas.ts`
  - Define shared error types/interfaces
  - Update all files to use shared types
  - Ensure consistency across API and client

- [ ] **TASK-023**: Add React Error Boundaries
  - Create `components/ErrorBoundary.tsx`
  - Wrap main app content in Error Boundary
  - Add fallback UI for errors
  - Log errors to monitoring service (if applicable)

### Documentation

- [ ] **TASK-024**: Create `.env.example` file
  - List all required environment variables
  - List all optional environment variables with defaults
  - Add comments explaining each variable
  - Do not include actual secrets or API keys

- [ ] **TASK-025**: Improve API documentation in README
  - Add comprehensive request/response examples
  - Document all error response types with examples
  - Document rate limiting details (headers, limits, reset times)
  - Add authentication requirements (if any)
  - Consider adding OpenAPI/Swagger spec

- [ ] **TASK-026**: Add JSDoc comments to public APIs
  - Add JSDoc to all exported functions in `lib/`
  - Document parameters, return types, and exceptions
  - Add examples where helpful
  - Focus on complex functions first (e.g., `extractRecipe`)

### Code Organization

- [ ] **TASK-027**: Break down complex `extractRecipe` method
  - Extract validation pass into separate function
  - Extract ingredient spacing repair into separate function
  - Extract times validation into separate function
  - Extract steps simplification into separate function
  - Improve readability and testability
  - Add unit tests for each extracted function

- [ ] **TASK-028**: Create constants file
  - Create `lib/constants.ts`
  - Move magic numbers: rate limit window, jitter factor, timeouts
  - Move magic strings: error types, headers
  - Import constants where needed
  - Document constants

### API Design

- [ ] **TASK-029**: Standardize error response format
  - Update `generate-pdf` route to use `{ error: { type, message } }` format
  - Ensure all API routes use consistent error structure
  - Update client code to handle standardized errors
  - Update tests
  - Document error response format

- [ ] **TASK-030**: Add rate limit headers to responses
  - Add `X-RateLimit-Limit` header
  - Add `X-RateLimit-Remaining` header
  - Add `X-RateLimit-Reset` header (timestamp)
  - Update `lib/rate-limit.ts` to return limit info
  - Update API route to include headers
  - Add tests

---

## 🟡 MEDIUM PRIORITY

### Security Hardening

- [ ] **TASK-031**: Add Content Security Policy headers
  - Determine CSP policy for application
  - Add CSP headers to `next.config.mjs`
  - Test CSP doesn't break functionality
  - Document CSP policy

- [ ] **TASK-032**: Fix API key validation in `lib/env.ts`
  - Make `GROQ_API_KEY` required in schema OR
  - Handle missing key more gracefully with clear error message
  - Update documentation to reflect requirement
  - Add validation test

### Performance

- [ ] **TASK-033**: Add request timeout to client fetch calls
  - Create `lib/api-client.ts` with timeout wrapper
  - Add AbortController with configurable timeout
  - Update `app/page.tsx` to use new client
  - Handle timeout errors gracefully
  - Add tests

- [ ] **TASK-034**: Consider response caching strategy
  - Evaluate caching needs (same URL = same recipe?)
  - Implement caching layer (in-memory or Redis)
  - Add cache headers to responses
  - Document caching behavior
  - Add cache invalidation strategy

### Code Quality

- [ ] **TASK-035**: Improve error messages
  - Review all error messages for clarity
  - Make error messages user-friendly
  - Add context where helpful
  - Ensure consistency in tone and format

- [ ] **TASK-036**: Add input sanitization review
  - Review all user inputs for XSS risks
  - Ensure proper escaping in PDF generation
  - Review recipe display for XSS
  - Add tests for XSS prevention

### Testing

- [ ] **TASK-037**: Create test utilities and fixtures
  - Create `tests/utils.ts` with helper functions
  - Create `tests/fixtures.ts` with test data
  - Create mock factories for common objects
  - Reduce test code duplication

- [ ] **TASK-038**: Add integration tests
  - Test full recipe extraction flow (API → service → client)
  - Test error propagation through layers
  - Test rate limiting end-to-end
  - Use test database/mocks as needed

---

## 🟢 LOW PRIORITY

### Documentation

- [ ] **TASK-039**: Expand architecture documentation
  - Add detailed architecture section to README
  - Explain design decisions
  - Add system diagram (if helpful)
  - Document data flow

- [ ] **TASK-040**: Create CONTRIBUTING.md
  - Document code style guidelines
  - Document testing requirements
  - Document PR process
  - Document commit message format
  - Add development setup instructions

### Code Organization

- [ ] **TASK-041**: Organize utility functions
  - Consider splitting `lib/utils.ts` by domain
  - Move ISO duration functions to `lib/time-utils.ts` or similar
  - Keep styling utilities separate
  - Document organization strategy

- [ ] **TASK-042**: Add `.gitattributes` file
  - Configure line endings (LF for all files)
  - Configure file types if needed
  - Ensure consistent behavior across platforms

### API Design

- [ ] **TASK-043**: Consider API versioning strategy
  - Research versioning approaches
  - Decide on versioning scheme (URL path vs header)
  - Document versioning policy
  - Implement if needed

### Dependencies

- [ ] **TASK-044**: Add dependency security audit to CI
  - Add `npm audit` to CI pipeline
  - Configure to fail on high/critical vulnerabilities
  - Document security update process
  - Consider Dependabot or similar tool

- [ ] **TASK-045**: Document dependency update process
  - Add section to README or CONTRIBUTING.md
  - Document how to check for outdated packages
  - Document update and testing process
  - Set schedule for dependency reviews

### Accessibility

- [ ] **TASK-046**: Audit and improve accessibility
  - Review all components for ARIA labels
  - Test keyboard navigation
  - Test with screen reader
  - Fix accessibility issues found
  - Add accessibility tests

---

## 📊 Progress Tracking

### Summary
- **Total Tasks:** 46
- **Critical:** 19 tasks
- **High Priority:** 11 tasks
- **Medium Priority:** 8 tasks
- **Low Priority:** 8 tasks

### Recommended Implementation Order

1. **Week 1: Foundation (Critical)**
   - TASK-001: TypeScript strict flags
   - TASK-002 through TASK-007: Eliminate `any` types
   - TASK-008: Add ESLint
   - TASK-009: Add Prettier

2. **Week 2: Testing (Critical)**
   - TASK-010 through TASK-016: Add comprehensive tests
   - TASK-037: Create test utilities

3. **Week 3: Security (Critical + High)**
   - TASK-017: CORS configuration
   - TASK-018: SSRF protection
   - TASK-019: Request size limits
   - TASK-031: CSP headers
   - TASK-032: API key validation

4. **Week 4: Error Handling & Documentation (High)**
   - TASK-020 through TASK-023: Error handling improvements
   - TASK-024 through TASK-026: Documentation
   - TASK-029: Standardize error responses

5. **Week 5: Code Quality & Organization (Medium)**
   - TASK-027: Refactor complex methods
   - TASK-028: Create constants file
   - TASK-033: Client timeout
   - TASK-035: Improve error messages

6. **Week 6: Polish (Low Priority)**
   - TASK-039 through TASK-046: Documentation, organization, accessibility

---

## Notes

- Tasks can be worked on in parallel where they don't conflict
- Some tasks may reveal additional issues - document and add to list
- Prioritize based on business needs and timeline
- Consider creating GitHub issues for tracking
- Review and update this list as tasks are completed

---

**Last Updated:** 2025-01-27


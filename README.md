# JUST THE DISH - AI-Powered Recipe Extractor

A modern web application that extracts clean, structured recipes from any cooking website using AI. Simply paste a recipe URL and get a beautifully formatted ingredient list and step-by-step instructions, with the option to download as a PDF.

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Groq AI](https://img.shields.io/badge/Groq-AI-FF6B6B?style=for-the-badge)](https://groq.com/)

## 🎯 Overview

JUST THE DISH is a full-stack recipe extraction application that leverages AI to parse and structure recipe data from any cooking website. The application uses Groq's fast inference API to intelligently extract recipe information, validate it with Zod schemas, and present it in a clean, user-friendly interface.

**Problem Solved:** Recipe websites are often cluttered with ads, stories, and unnecessary content that makes it difficult to quickly access the actual recipe. Many sites also have paywalls or require accounts. JUST THE DISH solves this by extracting just the essential recipe information—ingredients, steps, and timing—into a clean, printable format.

**Target Users:** Home cooks, meal planners, recipe collectors, and anyone who wants to quickly save and organize recipes from various websites without dealing with website clutter or paywalls.

## ✨ Features

- **🔗 URL-Based Recipe Extraction**
  - Paste any recipe URL from popular cooking websites
  - Automatic extraction of title, ingredients, steps, servings, and timing
  - Support for JSON-LD structured data when available
  - Intelligent ingredient spacing repair for better readability

- **🤖 AI-Powered Processing**
  - Multi-pass extraction pipeline for accuracy
  - Ingredient spacing detection and repair
  - Time field validation and normalization
  - Step simplification for clarity
  - Robust error handling with clear user feedback

- **✅ Comprehensive Validation**
  - Zod schemas for all inputs and AI responses
  - URL validation with security checks (no localhost/private IPs)
  - Type-safe error mapping to HTTP status codes
  - Input sanitization and data normalization

- **🔄 Resilient API Integration**
  - Configurable timeouts and retry logic
  - Exponential backoff with jitter for retries
  - Rate limit handling with automatic retry delays
  - Comprehensive error categorization and logging

- **📄 PDF Generation**
  - Download extracted recipes as clean PDF documents
  - Server-side PDF generation using PDFKit
  - Formatted for easy printing and sharing

- **🎨 Modern UI/UX**
  - Clean, responsive design with Tailwind CSS
  - shadcn/ui components for consistent styling
  - Interactive ingredient checklist
  - Loading states and error boundaries
  - Copy-to-clipboard functionality

- **🔒 Security & Privacy**
  - Environment variable validation
  - CORS configuration
  - Rate limiting (1 request per minute per IP)
  - No sensitive data logging
  - Protection against SSRF attacks

## 🛠️ Tech Stack

- **Framework:** Next.js 14.2 with App Router
- **Language:** TypeScript 5.0 (strict mode with full type safety)
- **Styling:** Tailwind CSS 4.1 with custom animations
- **UI Components:** shadcn/ui (Radix UI primitives)
- **AI/ML:** Groq SDK for fast LLM inference
- **Validation:** Zod for runtime type validation
- **PDF Generation:** PDFKit for server-side PDF creation
- **Testing:** Vitest with coverage reporting
- **Code Quality:** Biome for linting and formatting
- **Icons:** Lucide React
- **Deployment:** Vercel-ready

## 🎨 Technical Highlights

### Multi-Pass AI Extraction Pipeline

Built a sophisticated extraction system that uses multiple AI passes to improve accuracy:

- **Primary Extraction:** Initial recipe extraction with JSON-LD context when available
- **Ingredient Spacing Repair:** Detects and fixes concatenated ingredients (e.g., "1cupsugar" → "1 cup sugar")
- **Time Validation:** Validates and corrects time fields against source data
- **Step Simplification:** Rewrites steps for clarity while preserving meaning and order
- **Fallback Strategy:** Graceful degradation if any pass fails, ensuring users always get results

### Robust Error Handling & Retry Logic

Implemented a comprehensive error handling system:

- **Typed Error Categories:** Custom error classes for different failure modes (rate limits, quota exceeded, content blocked, etc.)
- **Exponential Backoff:** Jittered exponential backoff for retries to prevent thundering herd
- **Timeout Management:** Configurable request timeouts with proper cleanup
- **Rate Limit Handling:** Automatic retry with `Retry-After` header support
- **Error Mapping:** Consistent mapping of domain errors to HTTP status codes

### Type-Safe Validation Architecture

Built a complete validation layer using Zod:

- **Input Validation:** URL validation with security checks (SSRF protection)
- **Response Validation:** AI response parsing with strict schemas
- **Type Inference:** Automatic TypeScript type generation from Zod schemas
- **Error Messages:** User-friendly error messages for validation failures
- **Runtime Safety:** All untrusted data validated before use

### Environment Configuration System

Created a robust environment variable management system:

- **Schema-Based Validation:** Zod schema for all environment variables
- **Type Safety:** TypeScript types inferred from schema
- **Default Values:** Sensible defaults for optional configuration
- **Lazy Loading:** Cached validation for performance
- **Clear Error Messages:** Descriptive errors when validation fails

### Service-Oriented Architecture

Designed a clean separation of concerns:

- **API Routes:** Thin HTTP handlers with rate limiting and CORS
- **Service Layer:** Business logic in dedicated service classes
- **Client Layer:** Reusable API client with retry/timeout logic
- **Schema Layer:** Shared validation schemas and types
- **Utility Layer:** Reusable helper functions

### Performance Optimizations

- **Environment Caching:** Single validation and caching of environment variables
- **Efficient Error Handling:** Minimal overhead in error paths
- **Streaming PDF Generation:** Server-side PDF streaming for large recipes
- **Optimized Re-renders:** React best practices for component performance

## 📁 Project Structure

```
recipe_summarizer/
├── app/
│   ├── api/
│   │   ├── extract-recipe/
│   │   │   └── route.ts          # Recipe extraction API endpoint
│   │   └── generate-pdf/
│   │       └── route.ts          # PDF generation endpoint
│   ├── fonts/                    # Custom font files
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout with metadata
│   └── page.tsx                  # Main application page
├── components/
│   ├── ui/                       # Reusable UI components (shadcn/ui)
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── checkbox.tsx
│   │   ├── input.tsx
│   │   └── spinner.tsx
│   ├── error-boundary.tsx        # React error boundary
│   ├── error-display.tsx         # Error message component
│   ├── loading-display.tsx       # Loading state component
│   ├── recipe-display.tsx        # Recipe display with checklist
│   └── recipe-form.tsx           # URL input form
├── lib/
│   ├── constants.ts              # Application constants
│   ├── cors.ts                   # CORS configuration
│   ├── env.ts                    # Environment variable validation
│   ├── errors.ts                 # Error response utilities
│   ├── groq-client.ts            # Groq API client with retry logic
│   ├── groq-errors.ts            # Groq-specific error classes
│   ├── groq-extraction.ts        # Recipe extraction service
│   ├── groq-prompts.ts           # AI prompt templates
│   ├── groq-response.ts          # Response parsing utilities
│   ├── logger.ts                 # Logging utility
│   ├── rate-limit.ts             # Rate limiting implementation
│   ├── schemas.ts                # Zod validation schemas
│   └── utils.ts                  # Utility functions
├── public/                       # Static assets
│   ├── grain.svg
│   ├── herb-pattern.svg
│   └── herb-pattern-2.svg
├── tests/                        # Test files
│   ├── api/
│   │   ├── extract-recipe.test.ts
│   │   └── generate-pdf.test.ts
│   ├── groq-client.test.ts
│   ├── groq-prompts.test.ts
│   ├── groq-response.test.ts
│   ├── groq-retry.test.ts
│   ├── groq-service.test.ts
│   ├── rate-limit.test.ts
│   ├── setup.ts
│   └── utils.test.ts
├── .env.example                  # Environment variable template
├── biome.json                    # Biome configuration
├── next.config.mjs               # Next.js configuration
├── package.json                  # Dependencies and scripts
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
└── vitest.config.ts              # Vitest test configuration
```

## 💡 What I Learned

This project provided valuable experience in several advanced web development areas:

1. **AI Integration & Prompt Engineering:** Learned to design effective prompts for structured data extraction, handle multi-pass processing pipelines, and implement fallback strategies when AI responses are incomplete or malformed.

2. **Error Handling & Resilience:** Implemented comprehensive error handling with typed error categories, exponential backoff retry logic, and graceful degradation. Learned to map domain errors to appropriate HTTP status codes consistently.

3. **Type Safety with Zod:** Mastered runtime validation with Zod schemas, including complex validation rules, custom refinements, and type inference. Learned to validate all untrusted inputs at API boundaries.

4. **Service-Oriented Architecture:** Designed a clean architecture with separation of concerns—API routes, service layer, client layer, and schema layer. This made the codebase maintainable and testable.

5. **Security Best Practices:** Implemented SSRF protection, input validation, environment variable security, and proper error message handling to avoid information leakage.

6. **Performance Optimization:** Learned to optimize API calls by caching environment variables, implementing efficient retry logic, and using streaming for large responses like PDFs.

7. **Testing Strategies:** Created comprehensive test suites for API endpoints, services, and utilities. Learned to mock external dependencies and test error scenarios.

8. **Production Readiness:** Gained experience in building production-ready applications with proper logging, error handling, rate limiting, and deployment considerations.

## 🚀 Quick Start

1. **Install dependencies**
```bash
npm install
```

2. **Configure environment**
Create `.env.local` in the project root. See `.env.example` for all available options. Minimum:
```bash
GROQ_API_KEY=your_groq_api_key_here
```

3. **Run the app**
```bash
npm run dev
```
Visit `http://localhost:3000`.

## 📝 Notes

This project was built as a showcase of modern full-stack web development techniques, combining Next.js, TypeScript, AI integration, and robust error handling. The focus was on creating a production-ready application that demonstrates proficiency in API design, type safety, error handling, and AI/LLM integration.

The application demonstrates best practices for:
- Type-safe API development
- AI/LLM integration with error handling
- Runtime validation and security
- Service-oriented architecture
- Production-ready error handling and logging

## 📄 License

This project is private and intended for portfolio purposes.

---

**Built with ❤️ using Next.js, TypeScript, Groq AI, and Zod**

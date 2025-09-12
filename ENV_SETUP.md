# Environment Setup Guide

This document explains how to set up environment variables for the Just The Dish application.

## Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

### Google Gemini API Configuration

```bash
# Required: Your Google API key for Gemini
GOOGLE_API_KEY=your_google_api_key_here
```

**How to get a Google API Key:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Select your Google Cloud project (or create a new one)
4. Copy the generated API key
5. Add it to your `.env.local` file

### Optional Configuration

```bash
# Gemini model to use (default: gemini-2.0-flash-exp)
GEMINI_MODEL=gemini-2.0-flash-exp

# Request timeout in milliseconds (default: 30000)
GEMINI_REQUEST_TIMEOUT=30000

# Maximum number of retries for failed requests (default: 2)
GEMINI_MAX_RETRIES=2

# Base delay between retries in milliseconds (default: 1000)
GEMINI_RETRY_DELAY=1000

# Application URL (default: http://localhost:3000)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Node environment (default: development)
NODE_ENV=development
```

## Example .env.local File

```bash
# Google Gemini API Configuration
GOOGLE_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Gemini Model Configuration
GEMINI_MODEL=gemini-2.0-flash-exp
GEMINI_REQUEST_TIMEOUT=30000
GEMINI_MAX_RETRIES=2
GEMINI_RETRY_DELAY=1000

# Next.js Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Development
NODE_ENV=development
```

### Groq API Configuration

If you want to use Groq as a provider, add these to your `.env.local`:

```bash
# Groq API Configuration
GROQ_API_KEY=your_groq_api_key_here

# Optional Groq settings
# Example model; adjust to a model available to your Groq account
GROQ_MODEL=groq/llama-3.3-70b-versatile
GROQ_REQUEST_TIMEOUT=30000
GROQ_MAX_RETRIES=2
GROQ_RETRY_DELAY=1000

# Default provider selection (optional; can be overridden per request)
EXTRACTION_PROVIDER=groq
```

**How to get a Groq API Key:**
1. Sign in to the Groq console and create an API key
2. Copy the key into `GROQ_API_KEY`
3. Choose a supported `GROQ_MODEL` for your account

## Environment Validation

The application automatically validates environment variables on startup using Zod schemas. If any required variables are missing or invalid, you'll see a clear error message explaining what needs to be fixed.

## Security Notes

- Never commit `.env.local` or `.env` files to version control
- Keep your Google API key secure and don't share it
- Use different API keys for development and production environments
- Consider using Google Cloud Secret Manager for production deployments

## Troubleshooting

### "Invalid environment variables" Error

If you see an error about invalid environment variables:

1. Check that `.env.local` exists in the root directory
2. Ensure `GOOGLE_API_KEY` is set and not empty
3. Verify all optional numeric values are valid integers
4. Restart your development server after making changes

### API Key Issues

If you get authentication errors:

1. Verify your API key is correct and active
2. Check that the Gemini API is enabled in your Google Cloud project
3. Ensure your API key has the necessary permissions
4. Try regenerating the API key if issues persist

## Production Deployment

For production deployments:

1. Set environment variables in your hosting platform (Vercel, Netlify, etc.)
2. Use a production-specific Google API key
3. Set `NODE_ENV=production`
4. Configure appropriate timeout and retry values for your use case

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, RefreshCw, ExternalLink } from "lucide-react"
import type { RecipeError } from "@/app/page"

interface ErrorDisplayProps {
  error: RecipeError
  onRetry: () => void
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  const getErrorIcon = () => {
    switch (error.type) {
      case "rate-limit":
        return <AlertCircle className="h-5 w-5 text-destructive" />
      default:
        return <AlertCircle className="h-5 w-5 text-destructive" />
    }
  }

  const getErrorTitle = () => {
    switch (error.type) {
      case "invalid-url":
        return "Invalid URL"
      case "not-recipe":
        return "No Recipe Found"
      case "paywall":
        return "Content Behind Paywall"
      case "url-inaccessible":
        return "URL Not Accessible"
      case "parsing-failed":
        return "Recipe Parsing Failed"
      case "content-blocked":
        return "Content Blocked"
      case "ai-unavailable":
        return "AI Service Unavailable"
      case "quota-exceeded":
        return "Usage Limit Exceeded"
      case "network":
        return "Connection Error"
      case "rate-limit":
        return "Rate Limit Exceeded"
      case "server":
        return "Server Error"
      default:
        return "Error"
    }
  }

  const getSuggestions = () => {
    switch (error.type) {
      case "invalid-url":
        return [
          "Make sure the URL starts with http:// or https://",
          "Check for typos in the URL",
          "Try copying and pasting the URL directly from your browser",
        ]
      case "not-recipe":
        return [
          "Make sure the URL points to a recipe page, not a blog post or article",
          "Try a different recipe from the same website",
          'Look for URLs that contain words like "recipe" or "cooking"',
        ]
      case "paywall":
        return [
          "Try a free recipe website like AllRecipes or Food Network",
          "Look for the same recipe on a different website",
          "Some sites offer free articles with registration",
        ]
      case "url-inaccessible":
        return [
          "Check that the website is currently online",
          "Try accessing the URL directly in your browser",
          "Some websites may block automated access",
        ]
      case "parsing-failed":
        return [
          "The recipe format may not be supported",
          "Try a different recipe from a popular cooking website",
          "Some recipe formats are easier to extract than others",
        ]
      case "content-blocked":
        return [
          "The content was blocked by safety filters",
          "Try a different recipe URL",
          "Make sure the URL points to appropriate cooking content",
        ]
      case "ai-unavailable":
        return [
          "The AI service is temporarily unavailable",
          "Wait a few minutes and try again",
          "Check if there are any ongoing service issues",
        ]
      case "quota-exceeded":
        return [
          "Usage limit has been reached",
          "Try again later when the quota resets",
          "Consider upgrading for higher limits",
        ]
      case "network":
        return ["Check your internet connection", "Try refreshing the page", "Wait a moment and try again"]
      case "rate-limit":
        return [
          "You can try again in an hour",
          "Rate limiting helps keep the service available for everyone",
          "Consider bookmarking recipes for later extraction",
        ]
      default:
        return ["Try a different recipe URL", "Wait a moment and try again", "Check that the website is accessible"]
    }
  }

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          {getErrorIcon()}
          {getErrorTitle()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-foreground">{error.message}</p>

        <div className="space-y-2">
          <h4 className="font-medium text-foreground">Suggestions:</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {getSuggestions().map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={onRetry} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Another Recipe
          </Button>
          {error.type === "paywall" && (
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://www.allrecipes.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Browse Free Recipes
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

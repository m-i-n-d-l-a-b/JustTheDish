"use client"

import { useState } from "react"
import { RecipeForm } from "@/components/recipe-form"
import { RecipeDisplay } from "@/components/recipe-display"
import { ErrorDisplay } from "@/components/error-display"
import { LoadingDisplay } from "@/components/loading-display"

export interface Recipe {
  title: string
  ingredients: string[]
  steps: string[]
  servings?: string
  cookTime?: string
  prepTime?: string
}

export interface RecipeError {
  type: "invalid-url" | "not-recipe" | "paywall" | "network" | "rate-limit" | "server" | "url-inaccessible" | "parsing-failed" | "content-blocked" | "ai-unavailable" | "quota-exceeded"
  message: string
}

export default function RecipeSummarizerPage() {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [error, setError] = useState<RecipeError | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (url: string) => {
    setIsLoading(true)
    setError(null)
    setRecipe(null)

    try {
      const response = await fetch("/api/extract-recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error)
        return
      }

      setRecipe(data.recipe)
    } catch (err) {
      setError({
        type: "network",
        message: "Failed to connect to the server. Please check your internet connection and try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setRecipe(null)
    setError(null)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">Recipe Summarizer</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Extract and simplify recipes from any cooking website. Get clean ingredient lists and step-by-step
            instructions.
          </p>
        </header>

        {/* Main Content */}
        <div className="space-y-8">
          {/* URL Input Form */}
          <RecipeForm onSubmit={handleSubmit} disabled={isLoading} />

          {/* Loading State */}
          {isLoading && <LoadingDisplay />}

          {/* Error Display */}
          {error && <ErrorDisplay error={error} onRetry={handleReset} />}

          {/* Recipe Display */}
          {recipe && <RecipeDisplay recipe={recipe} onReset={handleReset} />}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>Extract recipes from your favorite cooking websites with ease.</p>
        </footer>
      </div>
    </main>
  )
}

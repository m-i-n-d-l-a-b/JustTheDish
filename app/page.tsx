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
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold font-serif text-foreground mb-4 text-balance">Just The Dish</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Skip the ads and pop-ups. Get straight to the recipe with organized ingredients and easy instructions,
            every time.
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
          <p>Your favorite recipes, simplified in seconds.</p>
        </footer>
      </div>
    </main>
  )
}

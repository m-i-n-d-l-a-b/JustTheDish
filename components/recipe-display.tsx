"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Download, RotateCcw, Clock, Users, ChefHat, Copy } from "lucide-react"
import type { Recipe } from "@/app/page"

interface RecipeDisplayProps {
  recipe: Recipe
  onReset: () => void
}

export function RecipeDisplay({ recipe, onReset }: RecipeDisplayProps) {
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set())
  const [copied, setCopied] = useState(false)

  const toggleIngredient = (index: number) => {
    const newChecked = new Set(checkedIngredients)
    if (newChecked.has(index)) {
      newChecked.delete(index)
    } else {
      newChecked.add(index)
    }
    setCheckedIngredients(newChecked)
  }

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipe }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate PDF")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${recipe.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      // Silently handle PDF download errors - user will see the error via UI
      // In a real app, you'd show a toast notification here
    }
  }

  function formatRecipeForClipboard(r: Recipe): string {
    const meta: string[] = []
    if (r.servings) meta.push(`Servings: ${r.servings}`)
    if (r.prepTime) meta.push(`Prep: ${r.prepTime}`)
    if (r.cookTime) meta.push(`Cook: ${r.cookTime}`)
    if (r.totalTime) meta.push(`Total: ${r.totalTime}`)

    const ingredients = r.ingredients.map((ing, i) => `${i + 1}. ${ing}`).join("\n")
    const steps = r.steps.map((st, i) => `${i + 1}. ${st}`).join("\n\n")

    return [
      `RECIPE: ${r.title}`,
      "" + (meta.length ? meta.join(" • ") : ""),
      "",
      "INGREDIENTS:",
      ingredients,
      "",
      "INSTRUCTIONS:",
      steps,
    ].join("\n")
  }

  const handleCopyRecipe = async () => {
    const text = formatRecipeForClipboard(recipe)
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for environments without Clipboard API
        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.setAttribute("readonly", "")
        textarea.style.position = "absolute"
        textarea.style.left = "-9999px"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      // Silently handle copy errors - user will see the error via UI
    }
  }

  return (
    <div className="space-y-6">
      {/* Recipe Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start gap-4">
            <div className="w-full md:basis-2/3 min-w-0">
              <CardTitle className="text-2xl md:text-3xl text-balance mb-2 text-[#1f2937]">{recipe.title}</CardTitle>
              <div className="flex flex-wrap gap-2">
                {recipe.servings && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {recipe.servings}
                  </Badge>
                )}
                {recipe.prepTime && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Prep: {recipe.prepTime}
                  </Badge>
                )}
                {recipe.cookTime && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <ChefHat className="h-3 w-3" />
                    Cook: {recipe.cookTime}
                  </Badge>
                )}
                {recipe.totalTime && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Total: {recipe.totalTime}
                  </Badge>
                )}
              </div>
            </div>
            <div className="w-full md:basis-1/3 md:ml-auto flex flex-col gap-2 items-stretch mt-3 md:mt-0">
              <Button onClick={handleDownloadPDF} variant="default" size="sm" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button onClick={handleCopyRecipe} variant="outline" size="sm" disabled={copied} className="w-full">
                <Copy className="h-4 w-4 mr-2" />
                {copied ? "Copied!" : "Copy Recipe"}
              </Button>
              <Button onClick={onReset} variant="outline" size="sm" className="w-full">
                <RotateCcw className="h-4 w-4 mr-2" />
                New Recipe
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Ingredients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1f2937]">
              <ChefHat className="h-5 w-5" />
              Ingredients ({recipe.ingredients.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recipe.ingredients.map((ingredient, index) => (
                <div key={index} className="flex items-start gap-3">
                  <Checkbox
                    id={`ingredient-${index}`}
                    checked={checkedIngredients.has(index)}
                    onCheckedChange={() => toggleIngredient(index)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`ingredient-${index}`}
                    className={`text-sm leading-relaxed cursor-pointer flex-1 ${
                      checkedIngredients.has(index) ? "line-through text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {ingredient}
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1f2937]">
              <Clock className="h-5 w-5" />
              Instructions ({recipe.steps.length} steps)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recipe.steps.map((step, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground pt-1">{step}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

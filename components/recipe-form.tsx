"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { ChefHat, Link } from "lucide-react"

interface RecipeFormProps {
  onSubmit: (url: string) => void
  disabled?: boolean
}

export function RecipeForm({ onSubmit, disabled }: RecipeFormProps) {
  const [url, setUrl] = useState("")
  const [urlError, setUrlError] = useState("")

  const validateUrl = (input: string): boolean => {
    try {
      const urlObj = new URL(input)
      return urlObj.protocol === "http:" || urlObj.protocol === "https:"
    } catch {
      return false
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) {
      setUrlError("Please enter a recipe URL")
      return
    }

    if (!validateUrl(url)) {
      setUrlError("Please enter a valid URL (must start with http:// or https://)")
      return
    }

    setUrlError("")
    onSubmit(url.trim())
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value)
    if (urlError) setUrlError("")
  }

  return (
    <Card className="w-full">
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 mb-4 text-[#1f2937]">
            <ChefHat className="h-5 w-5 text-current" />
            <h2 className="text-lg font-semibold">Enter Recipe URL</h2>
          </div>

          <div className="space-y-2">
            <div className="relative w-full">
              <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="url"
                placeholder="https://example.com/recipe"
                value={url}
                onChange={handleUrlChange}
                disabled={disabled}
                className={`pl-10 ${urlError ? "border-destructive" : ""}`}
                aria-describedby={urlError ? "url-error" : undefined}
              />
            </div>
            {urlError && (
              <p id="url-error" className="text-sm text-destructive" role="alert">
                {urlError}
              </p>
            )}
          </div>

          <Button type="submit" disabled={disabled || !url.trim()} className="w-full" size="lg">
            {disabled ? (
              <>
                <Spinner className="h-4 w-4" />
                Extracting...
              </>
            ) : (
              "Extract Recipe"
            )}
          </Button>
        </form>

        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-[#6b7280]">
          <Badge variant="outline">AllRecipes</Badge>
          <Badge variant="outline">Food Network</Badge>
          <Badge variant="outline">Bon Appétit</Badge>
          <span>+ dozens more</span>
        </div>
      </CardContent>
    </Card>
  )
}

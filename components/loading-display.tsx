import { Card, CardContent } from "@/components/ui/card"
import { ChefHat, Clock } from "lucide-react"

export function LoadingDisplay() {
  return (
    <Card>
      <CardContent className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <ChefHat className="h-12 w-12 text-primary animate-pulse" />
            <Clock className="h-6 w-6 text-muted-foreground absolute -bottom-1 -right-1 animate-spin" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Extracting Recipe</h3>
            <p className="text-sm text-muted-foreground max-w-md text-pretty">
              We're analyzing the webpage and extracting the recipe ingredients and instructions. This usually takes a
              few seconds.
            </p>
          </div>
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

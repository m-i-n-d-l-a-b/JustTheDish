import { Card, CardContent } from "@/components/ui/card";

export function LoadingDisplay(): JSX.Element {
  return (
    <Card>
      <CardContent className="p-8">
        <div className="space-y-6 animate-pulse" aria-busy="true" aria-live="polite">
          <div className="h-6 w-1/3 bg-muted rounded" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-5/6 bg-muted rounded" />
            <div className="h-4 w-2/3 bg-muted rounded" />
          </div>
          <div className="flex space-x-2">
            <div className="h-8 w-20 bg-muted rounded" />
            <div className="h-8 w-20 bg-muted rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

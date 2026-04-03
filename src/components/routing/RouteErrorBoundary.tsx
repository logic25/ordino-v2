import { Component, type ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[RouteErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <Card className="max-w-md w-full text-center">
            <CardHeader>
              <div className="mx-auto mb-2">
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
              <CardTitle>This page ran into a problem</CardTitle>
              <CardDescription>
                {this.state.error?.message || "An unexpected error occurred."}
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center gap-2">
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
              <Button onClick={this.handleRetry}>Try Again</Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

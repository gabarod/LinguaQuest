import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from "lucide-react";
import { useUser } from "./hooks/use-user";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import LessonPage from "./pages/LessonPage";
import { OnboardingTutorial } from "./components/OnboardingTutorial";

function App() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <OnboardingTutorial />; // Modified to show OnboardingTutorial for new users.
  }

  return (
    <Switch>
      <Route path="/onboarding" component={OnboardingTutorial} />
      <Route path="/" component={HomePage} />
      <Route path="/lesson/:id" component={LessonPage} />
    </Switch>
  );
}

export default function AppWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster />
    </QueryClientProvider>
  );
}
import { Switch, Route } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import WelcomePage from "./pages/WelcomePage";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import LessonsPage from "./pages/LessonsPage";
import LessonPage from "./pages/LessonPage";
import ChatPage from "./pages/ChatPage";
import BuddiesPage from "./pages/BuddiesPage";
import LeaderboardPage from "./pages/LeaderboardPage";
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
    return (
      <Switch>
        <Route path="/" component={WelcomePage} />
        <Route path="/auth" component={AuthPage} />
        <Route>{() => <WelcomePage />}</Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/onboarding" component={OnboardingTutorial} />
      <Route path="/" component={HomePage} />
      <Route path="/lessons" component={LessonsPage} />
      <Route path="/lesson/:id" component={LessonPage} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/buddies" component={BuddiesPage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold">404 Page Not Found</h1>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            The page you're looking for doesn't exist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

export default function AppWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster />
    </QueryClientProvider>
  );
}
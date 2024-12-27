import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import LessonsPage from "./pages/LessonsPage";
import LessonPage from "./pages/LessonPage";
import GamesPage from "./pages/GamesPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import { OnboardingTutorial } from "./components/OnboardingTutorial";
import { ProgressCelebration } from "./components/ProgressCelebration";

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
    return <AuthPage />; // Show auth page for non-authenticated users
  }

  return (
    <>
      <Switch>
        <Route path="/onboarding" component={OnboardingTutorial} />
        <Route path="/" component={HomePage} />
        <Route path="/lessons" component={LessonsPage} />
        <Route path="/lesson/:id" component={LessonPage} />
        <Route path="/games" component={GamesPage} />
        <Route path="/leaderboard" component={LeaderboardPage} />
      </Switch>
      <ProgressCelebration />
    </>
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
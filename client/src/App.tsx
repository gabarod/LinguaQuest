import { Switch, Route } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useUser } from "@/hooks/use-user";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import LessonsPage from "./pages/LessonsPage";
import LessonPage from "./pages/LessonPage";
import GamesPage from "./pages/GamesPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import LanguageExchangePage from "./pages/LanguageExchangePage";
import CommunityPage from "./pages/CommunityPage";
import { FlashcardsPage } from "./pages/FlashcardsPage";
import { OnboardingTutorial } from "./components/OnboardingTutorial";
import { ProgressCelebration } from "./components/ProgressCelebration";
import QuizPage from "./pages/QuizPage";
import PronunciationPractice from "./pages/PronunciationPractice";

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
    return <AuthPage />;
  }

  return (
    <>
      <Switch>
        <Route path="/onboarding" component={OnboardingTutorial} />
        <Route path="/" component={HomePage} />
        <Route path="/lessons" component={LessonsPage} />
        <Route path="/lesson/:id" component={LessonPage} />
        <Route path="/flashcards" component={FlashcardsPage} />
        <Route path="/games" component={GamesPage} />
        <Route path="/leaderboard" component={LeaderboardPage} />
        <Route path="/language-exchange" component={LanguageExchangePage} />
        <Route path="/community" component={CommunityPage} />
        <Route path="/quiz" component={QuizPage} />
        <Route path="/pronunciation" component={PronunciationPractice} />
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
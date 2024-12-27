import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { WordMatchGame } from "@/components/games/WordMatchGame";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useProgress } from "@/hooks/use-progress";
import { useToast } from "@/hooks/use-toast";

// Sample words for the game - In production, these would come from an API
const sampleWords = [
  { id: 1, word: "Hello", translation: "Hola" },
  { id: 2, word: "Goodbye", translation: "Adiós" },
  { id: 3, word: "Thank you", translation: "Gracias" },
  { id: 4, word: "Please", translation: "Por favor" },
  { id: 5, word: "Good morning", translation: "Buenos días" },
];

export default function GamesPage() {
  const { progress } = useProgress();
  const { toast } = useToast();
  const [currentGameScore, setCurrentGameScore] = useState(0);

  const handleGameComplete = (score: number) => {
    setCurrentGameScore(score);
    toast({
      title: "Game Complete!",
      description: `You scored ${score} points!`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto p-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Language Games</h1>
          <p className="text-muted-foreground">
            Practice your language skills through fun interactive games!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Word Match Challenge</CardTitle>
              <CardDescription>
                Match words with their translations to earn points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WordMatchGame 
                words={sampleWords}
                onComplete={handleGameComplete}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Gaming Stats</CardTitle>
              <CardDescription>
                Track your progress and achievements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Current Score</p>
                  <p className="text-2xl font-bold">{currentGameScore}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Total Points</p>
                  <p className="text-2xl font-bold">{progress?.totalPoints || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Games Completed</p>
                  <p className="text-2xl font-bold">{progress?.lessonsCompleted || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useLesson } from "@/hooks/use-lesson";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ShareAchievement } from "@/components/ShareAchievement";
import { type Exercise } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface PerformanceMetric {
  startTime: number;
  attempts: number;
}

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const { lesson, exercises, completeLesson } = useLesson(Number(id));
  const [currentExercise, setCurrentExercise] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [performanceMetric, setPerformanceMetric] = useState<PerformanceMetric>({
    startTime: Date.now(),
    attempts: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (exercises) {
      setProgress((currentExercise / exercises.length) * 100);
      // Reset performance metric for new exercise
      setPerformanceMetric({
        startTime: Date.now(),
        attempts: 0,
      });
    }
  }, [currentExercise, exercises]);

  const submitPerformanceMetric = async (correct: boolean) => {
    const responseTime = Date.now() - performanceMetric.startTime;
    const accuracy = correct ? 1.0 : 0.0;

    try {
      await fetch(`/api/exercises/${exercises?.[currentExercise].id}/performance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accuracy,
          responseTime,
          attemptCount: performanceMetric.attempts + 1,
        }),
      });
    } catch (error) {
      console.error("Failed to submit performance metric:", error);
    }
  };

  const handleAnswer = async (answer: string) => {
    const exercise = exercises?.[currentExercise];
    if (!exercise) return;

    setPerformanceMetric(prev => ({
      ...prev,
      attempts: prev.attempts + 1,
    }));

    if (answer === exercise.correctAnswer) {
      await submitPerformanceMetric(true);
      toast({
        title: "Correct!",
        description: "Great job!",
        variant: "default",
      });

      if (currentExercise + 1 >= (exercises?.length || 0)) {
        await completeLesson(Number(id));
        setShowShareDialog(true);
      } else {
        setCurrentExercise(prev => prev + 1);
      }
    } else {
      await submitPerformanceMetric(false);
      toast({
        title: "Incorrect",
        description: "Try again!",
        variant: "destructive",
      });
    }
  };

  if (!lesson || !exercises) {
    return <div>Loading...</div>;
  }

  const exercise = exercises[currentExercise];
  const difficulty = parseFloat(exercise.difficulty || "1.0");
  const difficultyLabel = difficulty <= 0.7 ? "Easy" : difficulty >= 1.3 ? "Hard" : "Medium";

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto p-4">
        <Progress value={progress} className="mb-4" />

        <Card className="mb-4">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-2xl font-bold">{lesson.title}</h1>
                <span className={`text-sm ${
                  difficulty >= 1.3 ? 'text-red-500' : 
                  difficulty <= 0.7 ? 'text-green-500' : 
                  'text-yellow-500'
                }`}>
                  Difficulty: {difficultyLabel}
                </span>
              </div>
              {showShareDialog && (
                <ShareAchievement
                  title={`Completed ${lesson.title}`}
                  description={`I just mastered ${lesson.type} skills in ${lesson.level} level!`}
                  points={lesson.points}
                  type={lesson.type}
                />
              )}
            </div>

            <p className="text-muted-foreground mb-6">{exercise.question}</p>

            <div className="grid grid-cols-1 gap-4">
              {exercise.options?.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto py-4 px-6 text-left"
                  onClick={() => handleAnswer(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
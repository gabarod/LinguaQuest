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

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const { lesson, exercises, completeLesson } = useLesson(Number(id));
  const [currentExercise, setCurrentExercise] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (exercises) {
      setProgress((currentExercise / exercises.length) * 100);
    }
  }, [currentExercise, exercises]);

  const handleAnswer = async (answer: string) => {
    const exercise = exercises?.[currentExercise];
    if (!exercise) return;

    if (answer === exercise.correctAnswer) {
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto p-4">
        <Progress value={progress} className="mb-4" />

        <Card className="mb-4">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold">{lesson.title}</h1>
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
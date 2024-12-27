import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Timer, Star, Award, Trophy } from "lucide-react";
import confetti from "canvas-confetti";

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
}

interface Quiz {
  id: number;
  title: string;
  description: string;
  language: string;
  difficulty: string;
  type: string;
  questions: QuizQuestion[];
  timeLimit: number;
}

export function QuizGame({ quizId }: { quizId: number }) {
  const { toast } = useToast();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<Array<{
    questionId: number;
    answer: string;
    correct: boolean;
    timeSpent: number;
  }>>([]);
  const [timeSpent, setTimeSpent] = useState(0);

  const { data: quiz, isLoading } = useQuery<Quiz>({
    queryKey: ["/api/quizzes", quizId],
  });

  const submitAttemptMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/quizzes/${quizId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, score }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      toast({
        title: "Quiz completed! 🎉",
        description: `You scored ${score} points!`,
      });
    },
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (quiz && !showExplanation && !submitAttemptMutation.isSuccess) {
      timer = setInterval(() => {
        setTimeSpent((prev) => {
          if (prev >= quiz.timeLimit) {
            submitAttemptMutation.mutate();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [quiz, showExplanation, submitAttemptMutation.isSuccess]);

  if (isLoading || !quiz) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Timer className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  const currentQuestionData = quiz.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;
  const timeLeft = quiz.timeLimit - timeSpent;

  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer || showExplanation) return;

    setSelectedAnswer(answer);
    const isCorrect = answer === currentQuestionData.correctAnswer;
    
    if (isCorrect) {
      setScore((prev) => prev + currentQuestionData.points);
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.7 }
      });
    }

    setAnswers((prev) => [
      ...prev,
      {
        questionId: currentQuestionData.id,
        answer,
        correct: isCorrect,
        timeSpent,
      },
    ]);

    setShowExplanation(true);
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setShowExplanation(false);

    if (currentQuestion + 1 === quiz.questions.length) {
      submitAttemptMutation.mutate();
    } else {
      setCurrentQuestion((prev) => prev + 1);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <Badge variant="outline" className="text-lg px-4 py-1">
          {quiz.difficulty.toUpperCase()}
        </Badge>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Timer className="w-4 h-4" />
          <span>{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
        </div>
      </div>

      <Progress value={progress} className="mb-8" />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -20, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">
              {currentQuestionData.question}
            </h2>

            <div className="grid gap-4">
              {currentQuestionData.options.map((option, index) => (
                <motion.div
                  key={option}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Button
                    variant={
                      showExplanation
                        ? option === currentQuestionData.correctAnswer
                          ? "default"
                          : option === selectedAnswer
                          ? "destructive"
                          : "outline"
                        : selectedAnswer === option
                        ? "default"
                        : "outline"
                    }
                    className="w-full justify-start text-left h-auto py-3 px-4"
                    onClick={() => handleAnswerSelect(option)}
                    disabled={!!selectedAnswer || showExplanation}
                  >
                    {option}
                    {showExplanation && option === currentQuestionData.correctAnswer && (
                      <Star className="w-4 h-4 ml-2 text-primary" />
                    )}
                  </Button>
                </motion.div>
              ))}
            </div>

            <AnimatePresence>
              {showExplanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 p-4 bg-muted rounded-lg"
                >
                  <p className="text-sm">{currentQuestionData.explanation}</p>
                  <Button
                    className="mt-4"
                    onClick={handleNextQuestion}
                  >
                    {currentQuestion + 1 === quiz.questions.length ? (
                      <>
                        Finish Quiz
                        <Trophy className="w-4 h-4 ml-2" />
                      </>
                    ) : (
                      <>
                        Next Question
                        <Award className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between items-center">
        <Badge variant="secondary" className="text-lg">
          Question {currentQuestion + 1}/{quiz.questions.length}
        </Badge>
        <Badge variant="secondary" className="text-lg">
          Score: {score}
        </Badge>
      </div>
    </div>
  );
}

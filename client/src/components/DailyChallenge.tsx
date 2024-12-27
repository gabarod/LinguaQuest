import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Flame, Trophy, Star, Timer } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ShareAchievement } from "./ShareAchievement";
import { format } from "date-fns";

interface Challenge {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  points: number;
  questions: {
    question: string;
    options: string[];
    correctAnswer: string;
  }[];
  completed?: boolean;
  score?: number;
}

export function DailyChallenge() {
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  const { data: challenge, isLoading } = useQuery<Challenge>({
    queryKey: ["/api/challenges/daily"],
  });

  const submitMutation = useMutation({
    mutationFn: async (answers: string[]) => {
      const response = await fetch(`/api/challenges/${challenge!.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      setShowResults(true);
      if (data.score === challenge?.points) {
        toast({
          title: "¡Perfecto!",
          description: "Has completado el desafío diario con una puntuación perfecta.",
        });
      } else {
        toast({
          title: "¡Buen trabajo!",
          description: `Has ganado ${data.score} puntos en el desafío diario.`,
        });
      }
    },
  });

  const handleAnswer = (answer: string) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setSelectedAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < challenge!.questions.length - 1) {
      setCurrentQuestionIndex((prev: number) => prev + 1);
    } else {
      submitMutation.mutate(selectedAnswers);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex justify-center items-center h-64">
          <Timer className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!challenge) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex flex-col items-center justify-center h-64 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No hay desafíos disponibles</h3>
          <p className="text-sm text-muted-foreground">
            Vuelve mañana para nuevos desafíos
          </p>
        </CardContent>
      </Card>
    );
  }

  if (challenge.completed) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex flex-col items-center justify-center h-64 text-center p-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mb-4"
          >
            <Star className="h-12 w-12 text-yellow-500" />
          </motion.div>
          <h3 className="text-lg font-semibold mb-2">
            ¡Desafío completado!
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Has ganado {challenge.score} puntos hoy
          </p>
          <ShareAchievement
            title="Desafío Diario Completado"
            description={`He completado el desafío '${challenge.title}' y ganado ${challenge.score} puntos`}
            points={challenge.score ?? 0}
            type="Daily Challenge"
          />
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = challenge.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / challenge.questions.length) * 100;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold">{challenge.title}</CardTitle>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium">{challenge.points} pts</span>
          </div>
        </div>
        <CardDescription>{challenge.description}</CardDescription>
        <Progress value={progress} className="mt-2" />
      </CardHeader>

      <CardContent className="space-y-6">
        <AnimatePresence mode="wait">
          {!showResults ? (
            <motion.div
              key="question"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-medium mb-4">
                {currentQuestion.question}
              </h3>
              <RadioGroup
                value={selectedAnswers[currentQuestionIndex]}
                onValueChange={handleAnswer}
              >
                {currentQuestion.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`}>{option}</Label>
                  </div>
                ))}
              </RadioGroup>
              <div className="flex justify-between items-center mt-6">
                <span className="text-sm text-muted-foreground">
                  Pregunta {currentQuestionIndex + 1} de {challenge.questions.length}
                </span>
                <Button
                  onClick={handleNext}
                  disabled={!selectedAnswers[currentQuestionIndex]}
                >
                  {currentQuestionIndex === challenge.questions.length - 1
                    ? "Finalizar"
                    : "Siguiente"}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <h3 className="text-lg font-medium mb-2">
                ¡Desafío completado!
              </h3>
              <p className="text-sm text-muted-foreground">
                Tus respuestas han sido enviadas
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
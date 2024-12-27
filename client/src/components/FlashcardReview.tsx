import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

interface Flashcard {
  id: number;
  term: string;
  definition: string;
  context: string;
  examples: string[];
  difficulty: number;
  proficiency: number;
}

export function FlashcardReview() {
  const [showAnswer, setShowAnswer] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: flashcards, isLoading } = useQuery<Flashcard[]>({
    queryKey: ["/api/flashcards/review"],
  });

  const progressMutation = useMutation({
    mutationFn: async ({ 
      flashcardId, 
      correct, 
      responseTime 
    }: { 
      flashcardId: number; 
      correct: boolean; 
      responseTime: number;
    }) => {
      const response = await fetch(`/api/flashcards/${flashcardId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correct, responseTime }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/review"] });
    },
  });

  useEffect(() => {
    if (flashcards?.length && !startTime) {
      setStartTime(Date.now());
    }
  }, [flashcards]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!flashcards?.length) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">No flashcards due for review!</p>
        </CardContent>
      </Card>
    );
  }

  const currentCard = flashcards[currentIndex];

  const handleResponse = async (correct: boolean) => {
    const responseTime = Date.now() - startTime;
    
    try {
      await progressMutation.mutateAsync({
        flashcardId: currentCard.id,
        correct,
        responseTime,
      });

      setShowAnswer(false);
      setStartTime(Date.now());

      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        toast({
          title: "Review Complete!",
          description: "You've reviewed all your due flashcards.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save progress",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Card {currentIndex + 1} of {flashcards.length}
        </p>
        <Progress value={(currentIndex / flashcards.length) * 100} className="w-1/3" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard.id + (showAnswer ? "-answer" : "-question")}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="min-h-[300px]">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {!showAnswer ? (
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-4">{currentCard.term}</h3>
                    {currentCard.context && (
                      <p className="text-muted-foreground italic">
                        Context: {currentCard.context}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold">Definition:</h4>
                      <p>{currentCard.definition}</p>
                    </div>
                    {currentCard.examples?.length > 0 && (
                      <div>
                        <h4 className="font-semibold">Examples:</h4>
                        <ul className="list-disc list-inside space-y-2">
                          {currentCard.examples.map((example, i) => (
                            <li key={i} className="text-muted-foreground">
                              {example}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-center gap-4">
        {!showAnswer ? (
          <Button
            size="lg"
            onClick={() => setShowAnswer(true)}
          >
            Show Answer
          </Button>
        ) : (
          <>
            <Button
              variant="destructive"
              size="lg"
              onClick={() => handleResponse(false)}
            >
              Incorrect
            </Button>
            <Button
              variant="default"
              size="lg"
              onClick={() => handleResponse(true)}
            >
              Correct
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

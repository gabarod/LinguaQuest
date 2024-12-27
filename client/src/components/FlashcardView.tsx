import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Flashcard {
  id: number;
  term: string;
  definition: string;
  context: string;
  examples: string[];
  language: string;
  proficiency: number;
}

export function FlashcardView() {
  const [isFlipped, setIsFlipped] = useState(false);
  const queryClient = useQueryClient();

  const { data: flashcards, isLoading } = useQuery<Flashcard[]>({
    queryKey: ["/api/flashcards"],
  });

  const [currentIndex, setCurrentIndex] = useState(0);

  const reviewMutation = useMutation({
    mutationFn: async ({ id, correct, responseTime }: { id: number; correct: boolean; responseTime: number }) => {
      const response = await fetch(`/api/flashcards/${id}/review`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!flashcards?.length) {
    return (
      <div className="text-center p-6">
        <p className="text-muted-foreground">No flashcards available.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Generate some flashcards to start practicing!
        </p>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];

  const handleReview = (correct: boolean) => {
    if (!currentCard) return;

    reviewMutation.mutate({
      id: currentCard.id,
      correct,
      responseTime: 0, // You could add a timer to track response time
    });

    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % flashcards.length);
  };

  return (
    <div className="space-y-6">
      <div className="relative h-96">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard.id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            <Card
              className="h-full cursor-pointer"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <CardContent className="h-full flex flex-col items-center justify-center p-6">
                <AnimatePresence mode="wait">
                  {isFlipped ? (
                    <motion.div
                      key="back"
                      initial={{ opacity: 0, rotateY: -180 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      exit={{ opacity: 0, rotateY: 180 }}
                      transition={{ duration: 0.3 }}
                      className="text-center"
                    >
                      <h3 className="text-xl font-semibold mb-4">Definition</h3>
                      <p className="mb-4">{currentCard.definition}</p>
                      {currentCard.examples.length > 0 && (
                        <div className="mt-6 text-sm text-muted-foreground">
                          <h4 className="font-semibold mb-2">Examples:</h4>
                          <ul className="list-disc list-inside">
                            {currentCard.examples.map((example, i) => (
                              <li key={i}>{example}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="front"
                      initial={{ opacity: 0, rotateY: 180 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      exit={{ opacity: 0, rotateY: -180 }}
                      transition={{ duration: 0.3 }}
                      className="text-center"
                    >
                      <h3 className="text-3xl font-bold mb-4">{currentCard.term}</h3>
                      {currentCard.context && (
                        <p className="text-sm text-muted-foreground">
                          Context: {currentCard.context}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-center gap-4">
        <Button
          variant="destructive"
          onClick={() => handleReview(false)}
          disabled={!isFlipped}
        >
          Incorrect
        </Button>
        <Button
          variant="default"
          onClick={() => handleReview(true)}
          disabled={!isFlipped}
        >
          Correct
        </Button>
      </div>

      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Card {currentIndex + 1} of {flashcards.length}</span>
        <span>Proficiency: {currentCard.proficiency}/5</span>
      </div>
    </div>
  );
}

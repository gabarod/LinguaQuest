import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, RotateCcw, Check, Clock } from "lucide-react";
import type { SupportedLanguage } from "@db/schema";

const flashcardSchema = z.object({
  term: z.string().min(1, "Term is required"),
  definition: z.string().min(1, "Definition is required"),
  context: z.string().optional(),
  examples: z.array(z.string()),
  language: z.string(),
  tags: z.array(z.string()),
});

interface FlashcardData {
  id: number;
  term: string;
  definition: string;
  context?: string;
  examples: string[];
  language: string;
  tags: string[];
  difficulty: number;
  lastReviewed?: string;
  nextReview?: string;
  proficiency: number;
}

interface Props {
  language: SupportedLanguage;
}

export function FlashcardSystem({ language }: Props) {
  const [isCreating, setIsCreating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(flashcardSchema),
    defaultValues: {
      term: "",
      definition: "",
      context: "",
      examples: [],
      language,
      tags: [],
    },
  });

  // Obtener flashcards del usuario
  const { data: flashcards } = useQuery<FlashcardData[]>({
    queryKey: ["/api/flashcards", language],
  });

  // Obtener flashcards para revisar
  const { data: reviewCards } = useQuery<FlashcardData[]>({
    queryKey: ["/api/flashcards/review", language],
    enabled: isReviewing,
  });

  // Mutación para crear flashcard
  const createFlashcardMutation = useMutation({
    mutationFn: async (data: z.infer<typeof flashcardSchema>) => {
      const response = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to create flashcard");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards"] });
      setIsCreating(false);
      form.reset();
      toast({
        title: "Success",
        description: "Flashcard created successfully",
      });
    },
  });

  // Mutación para revisar flashcard
  const reviewFlashcardMutation = useMutation({
    mutationFn: async ({
      id,
      correct,
      responseTime,
    }: {
      id: number;
      correct: boolean;
      responseTime: number;
    }) => {
      const response = await fetch(`/api/flashcards/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correct, responseTime }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit review");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/review"] });
    },
  });

  const onSubmit = (data: z.infer<typeof flashcardSchema>) => {
    createFlashcardMutation.mutate(data);
  };

  const startReview = () => {
    setIsReviewing(true);
    setCurrentCard(0);
  };

  const handleReview = (correct: boolean) => {
    if (!reviewCards?.[currentCard]) return;

    const startTime = Date.now();
    reviewFlashcardMutation.mutate({
      id: reviewCards[currentCard].id,
      correct,
      responseTime: Date.now() - startTime,
    });

    if (currentCard + 1 < (reviewCards?.length ?? 0)) {
      setCurrentCard(prev => prev + 1);
    } else {
      setIsReviewing(false);
      toast({
        title: "Review Complete",
        description: "You've completed your flashcard review session!",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Flashcards</h2>
        <div className="space-x-2">
          <Button
            variant={isCreating ? "destructive" : "default"}
            onClick={() => setIsCreating(!isCreating)}
          >
            {isCreating ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create Flashcard
              </>
            )}
          </Button>
          {!isCreating && (
            <Button onClick={startReview} disabled={isReviewing}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Review Cards
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Create New Flashcard</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="term"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Term</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="definition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Definition</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="context"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Context (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={createFlashcardMutation.isPending}>
                      Create Flashcard
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {isReviewing && reviewCards && reviewCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center space-y-6">
                  <div className="text-sm text-muted-foreground">
                    Card {currentCard + 1} of {reviewCards.length}
                  </div>

                  <div className="w-full aspect-[3/2] relative perspective-1000">
                    <motion.div
                      className="w-full h-full [transform-style:preserve-3d] cursor-pointer"
                      animate={{ rotateY: 180 }}
                      transition={{ duration: 0.6 }}
                    >
                      <div className="absolute inset-0 backface-hidden">
                        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                          <h3 className="text-2xl font-bold mb-4">
                            {reviewCards[currentCard].term}
                          </h3>
                          {reviewCards[currentCard].context && (
                            <p className="text-sm text-muted-foreground">
                              {reviewCards[currentCard].context}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      variant="destructive"
                      onClick={() => handleReview(false)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Incorrect
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => handleReview(true)}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Correct
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!isCreating && !isReviewing && flashcards && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {flashcards.map((flashcard) => (
              <Card key={flashcard.id}>
                <CardContent className="pt-6">
                  <h3 className="font-bold mb-2">{flashcard.term}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {flashcard.definition}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>
                      Next review:{" "}
                      {flashcard.nextReview
                        ? new Date(flashcard.nextReview).toLocaleDateString()
                        : "Not reviewed yet"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {flashcard.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

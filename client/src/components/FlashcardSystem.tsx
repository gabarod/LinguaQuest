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
import { Plus, X, RotateCcw, Check, Clock, Image as ImageIcon } from "lucide-react";
import type { SupportedLanguage } from "@db/schema";

const flashcardSchema = z.object({
  term: z.string().min(1, "Term is required"),
  definition: z.string().min(1, "Definition is required"),
  translation: z.string().min(1, "Translation is required"),
  imageUrl: z.string().optional(),
  context: z.string().optional(),
  examples: z.array(z.string()),
  language: z.string(),
  tags: z.array(z.string()),
  multipleChoiceOptions: z.array(z.string()).min(3, "At least 3 options are required"),
});

interface FlashcardData {
  id: number;
  term: string;
  definition: string;
  translation: string;
  imageUrl?: string;
  context?: string;
  examples: string[];
  language: string;
  tags: string[];
  multipleChoiceOptions: string[];
  difficulty: number;
  lastReviewed?: string;
  nextReview?: string;
  proficiency: number;
  wrongAttempts: number;
}

interface Props {
  language: SupportedLanguage;
}

export function FlashcardSystem({ language }: Props) {
  const [isCreating, setIsCreating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(flashcardSchema),
    defaultValues: {
      term: "",
      definition: "",
      translation: "",
      imageUrl: "",
      context: "",
      examples: [],
      language,
      tags: [],
      multipleChoiceOptions: [],
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

  // Mutación para revisar flashcard con SRS
  const reviewFlashcardMutation = useMutation({
    mutationFn: async ({
      id,
      correct,
      selectedOption,
    }: {
      id: number;
      correct: boolean;
      selectedOption: string;
    }) => {
      const response = await fetch(`/api/flashcards/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correct, selectedOption }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit review");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/review"] });

      if (data.correct) {
        toast({
          title: "¡Correcto!",
          description: "¡Muy bien! Sigamos practicando.",
        });
      } else {
        toast({
          title: "Casi...",
          description: "Esta tarjeta aparecerá de nuevo más tarde para repasarla.",
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: z.infer<typeof flashcardSchema>) => {
    createFlashcardMutation.mutate(data);
  };

  const handleOptionSelect = (option: string) => {
    if (!reviewCards?.[currentCard]) return;

    const isCorrect = option === reviewCards[currentCard].definition;
    setSelectedOption(option);

    reviewFlashcardMutation.mutate({
      id: reviewCards[currentCard].id,
      correct: isCorrect,
      selectedOption: option,
    });

    // Esperar un momento para mostrar el resultado antes de pasar a la siguiente tarjeta
    setTimeout(() => {
      if (currentCard + 1 < (reviewCards?.length ?? 0)) {
        setCurrentCard(prev => prev + 1);
        setSelectedOption(null);
        setShowAnswer(false);
      } else {
        setIsReviewing(false);
        toast({
          title: "¡Repaso completado!",
          description: "Has terminado tu sesión de repaso.",
        });
      }
    }, 1500);
  };

  const startReview = () => {
    setIsReviewing(true);
    setCurrentCard(0);
    setShowAnswer(false);
    setSelectedOption(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Vocabulario</h2>
        <div className="space-x-2">
          <Button
            variant={isCreating ? "destructive" : "default"}
            onClick={() => setIsCreating(!isCreating)}
          >
            {isCreating ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Agregar Palabra
              </>
            )}
          </Button>
          {!isCreating && (
            <Button onClick={startReview} disabled={isReviewing}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Practicar
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
                <CardTitle>Agregar Nueva Palabra</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="term"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Palabra</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="translation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Traducción</FormLabel>
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
                          <FormLabel>Definición</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL de la Imagen (Opcional)</FormLabel>
                          <FormControl>
                            <Input {...field} type="url" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={createFlashcardMutation.isPending}>
                      Crear Tarjeta
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
                    Tarjeta {currentCard + 1} de {reviewCards.length}
                  </div>

                  <div className="w-full max-w-md aspect-[3/2] relative perspective-1000">
                    <motion.div
                      className="w-full h-full [transform-style:preserve-3d] cursor-pointer"
                      animate={{ rotateY: showAnswer ? 180 : 0 }}
                      transition={{ duration: 0.6 }}
                      onClick={() => !selectedOption && setShowAnswer(!showAnswer)}
                    >
                      <div className="absolute inset-0 backface-hidden">
                        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                          <h3 className="text-2xl font-bold mb-4">
                            {reviewCards[currentCard].term}
                          </h3>
                          {reviewCards[currentCard].imageUrl && (
                            <img
                              src={reviewCards[currentCard].imageUrl}
                              alt={reviewCards[currentCard].term}
                              className="max-h-32 mb-4 object-contain"
                            />
                          )}
                        </div>
                      </div>

                      <div className="absolute inset-0 backface-hidden [transform:rotateY(180deg)]">
                        <div className="flex flex-col items-center justify-center h-full p-6">
                          <p className="text-xl mb-2">{reviewCards[currentCard].translation}</p>
                          <p className="text-sm text-muted-foreground">
                            {reviewCards[currentCard].definition}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                    {reviewCards[currentCard].multipleChoiceOptions.map((option, index) => (
                      <Button
                        key={index}
                        variant={
                          selectedOption
                            ? option === reviewCards[currentCard].definition
                              ? "default"
                              : option === selectedOption
                              ? "destructive"
                              : "outline"
                            : "outline"
                        }
                        className="h-auto py-4 text-left"
                        onClick={() => !selectedOption && handleOptionSelect(option)}
                        disabled={!!selectedOption}
                      >
                        {option}
                      </Button>
                    ))}
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
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold">{flashcard.term}</h3>
                    {flashcard.imageUrl && (
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm font-medium mb-1">{flashcard.translation}</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {flashcard.definition}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>
                      Próximo repaso:{" "}
                      {flashcard.nextReview
                        ? new Date(flashcard.nextReview).toLocaleDateString()
                        : "No repasado aún"}
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
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuizGame } from "@/components/QuizGame";
import { supportedLanguages } from "@db/schema";
import { Brain, Gamepad, Languages } from "lucide-react";

export default function QuizPage() {
  const { toast } = useToast();
  const [selectedLanguage, setSelectedLanguage] = useState<string>();
  const [activeQuizId, setActiveQuizId] = useState<number>();

  const generateQuizMutation = useMutation({
    mutationFn: async (language: string) => {
      const response = await fetch("/api/quizzes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (quiz) => {
      setActiveQuizId(quiz.id);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate quiz",
      });
    },
  });

  if (activeQuizId) {
    return <QuizGame quizId={activeQuizId} />;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto space-y-8"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-6 h-6" />
              Language Learning Quiz
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Languages className="w-4 h-4" />
                Select Language
              </label>
              <Select
                value={selectedLanguage}
                onValueChange={setSelectedLanguage}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a language" />
                </SelectTrigger>
                <SelectContent>
                  {supportedLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!selectedLanguage || generateQuizMutation.isPending}
              onClick={() => selectedLanguage && generateQuizMutation.mutate(selectedLanguage)}
            >
              {generateQuizMutation.isPending ? (
                "Generating Quiz..."
              ) : (
                <>
                  Start Quiz
                  <Gamepad className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
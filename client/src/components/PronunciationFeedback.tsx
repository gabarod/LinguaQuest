import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle2, Volume2 } from "lucide-react";
import { motion } from "framer-motion";

interface PronunciationFeedbackProps {
  score: number;
  feedback: string[];
  correctPhonemes: string[];
  incorrectPhonemes: string[];
  suggestions: string[];
  isLoading?: boolean;
}

export function PronunciationFeedback({
  score,
  feedback,
  correctPhonemes,
  incorrectPhonemes,
  suggestions,
  isLoading = false,
}: PronunciationFeedbackProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    return "text-red-500";
  };

  const MotionCard = motion(Card);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4">
            <Volume2 className="w-8 h-8 animate-pulse text-gray-400" />
            <div className="text-sm text-gray-500">Analyzing pronunciation...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <MotionCard
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Pronunciation Analysis
          <span className={`text-2xl font-mono ${getScoreColor(score)}`}>
            {score.toFixed(1)}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={score} className="h-2" />
          <div className="flex justify-between text-sm text-gray-500">
            <span>Needs Practice</span>
            <span>Excellent</span>
          </div>
        </div>

        {/* Feedback Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Feedback</h3>
            <ScrollArea className="h-24 rounded-md border p-2">
              {feedback.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 mb-2"
                >
                  <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-600">{item}</p>
                </div>
              ))}
            </ScrollArea>
          </div>

          {/* Phonemes Analysis */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Phonemes Analysis</h3>
            <div className="flex flex-wrap gap-2">
              {correctPhonemes.map((phoneme, index) => (
                <Badge
                  key={`correct-${index}`}
                  variant="secondary"
                  className="bg-green-100 text-green-800"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {phoneme}
                </Badge>
              ))}
              {incorrectPhonemes.map((phoneme, index) => (
                <Badge
                  key={`incorrect-${index}`}
                  variant="secondary"
                  className="bg-red-100 text-red-800"
                >
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {phoneme}
                </Badge>
              ))}
            </div>
          </div>

          {/* Improvement Suggestions */}
          <div>
            <h3 className="text-sm font-medium mb-2">Suggestions</h3>
            <ScrollArea className="h-24 rounded-md border p-2">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 mb-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                  <p className="text-sm text-gray-600">{suggestion}</p>
                </div>
              ))}
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </MotionCard>
  );
}

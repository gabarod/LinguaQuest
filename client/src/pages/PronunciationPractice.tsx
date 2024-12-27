import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AudioRecorder } from "@/components/AudioRecorder";
import { PronunciationFeedback } from "@/components/PronunciationFeedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Mic, Volume2 } from "lucide-react";
import { supportedLanguages } from "@db/schema";

export default function PronunciationPractice() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>();
  const [text, setText] = useState("");
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const { toast } = useToast();

  const analyzeAudioMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("text", text);
      formData.append("language", selectedLanguage!);

      const response = await fetch("/api/pronunciation/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to analyze pronunciation. Please try again.",
      });
    },
  });

  const handleRecordingComplete = (audioBlob: Blob) => {
    if (!selectedLanguage || !text.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a language and enter text to practice.",
      });
      return;
    }

    analyzeAudioMutation.mutate(audioBlob);
  };

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
              <Volume2 className="w-6 h-6" />
              Pronunciation Practice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Language</label>
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

              <div>
                <label className="text-sm font-medium">Text to Practice</label>
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter text to practice pronunciation"
                  className="mt-1"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                isProcessing={analyzeAudioMutation.isPending}
              />

              {analyzeAudioMutation.isPending && (
                <div className="text-center text-sm text-gray-500">
                  Analyzing your pronunciation...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {analysisResult && (
          <PronunciationFeedback
            score={analysisResult.score}
            feedback={analysisResult.feedback}
            correctPhonemes={analysisResult.correctPhonemes}
            incorrectPhonemes={analysisResult.incorrectPhonemes}
            suggestions={analysisResult.suggestions}
          />
        )}
      </motion.div>
    </div>
  );
}

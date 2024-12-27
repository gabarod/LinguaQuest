import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, Mic, Play, Star, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AudioRecorder } from "./AudioRecorder";
import confetti from "canvas-confetti";

interface Challenge {
  id: number;
  text: string;
  language: string;
  difficulty: number;
  points: number;
}

interface Attempt {
  score: number;
  feedback: {
    pronunciation: string[];
    intonation: string[];
    fluency: string[];
  };
}

export function PronunciationChallenge() {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: challenges } = useQuery<Challenge[]>({
    queryKey: ["/api/pronunciation-challenges"],
  });

  const submitAttemptMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/pronunciation/analyze", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      setLastAttempt(data);
      queryClient.invalidateQueries({ queryKey: ["/api/pronunciation-challenges"] });

      if (data.score >= 0.8) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }

      toast({
        title: "Challenge completed!",
        description: `You scored ${Math.round(data.score * 100)}%`,
      });
      setIsProcessing(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  const handleStartChallenge = (challenge: Challenge) => {
    setCurrentChallenge(challenge);
    setLastAttempt(null);
    setAudioBlob(null);
  };

  const handleRecordingComplete = (blob: Blob) => {
    setAudioBlob(blob);
  };

  const handleSubmitAttempt = async () => {
    if (!audioBlob || !currentChallenge) return;
    setIsProcessing(true);

    const formData = new FormData();
    formData.append("audio", audioBlob);
    formData.append("text", currentChallenge.text);
    formData.append("language", currentChallenge.language);
    if (currentChallenge.id) {
      formData.append("challengeId", currentChallenge.id.toString());
    }

    submitAttemptMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      {!currentChallenge ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {challenges?.map((challenge) => (
            <Card
              key={challenge.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleStartChallenge(challenge)}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Level {challenge.difficulty}</span>
                  <div className="flex items-center gap-2 text-yellow-500">
                    <Star className="h-4 w-4" />
                    <span>{challenge.points}</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{challenge.text}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Language: {challenge.language}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Pronunciation Challenge</span>
              <Button
                variant="ghost"
                onClick={() => setCurrentChallenge(null)}
              >
                Choose Another
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-4">{currentChallenge.text}</h3>
              {audioBlob ? (
                <div className="flex justify-center gap-4">
                  <Button
                    onClick={() => audioRef.current?.play()}
                    variant="outline"
                    size="icon"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => setAudioBlob(null)}>
                    Record Again
                  </Button>
                  <Button onClick={handleSubmitAttempt} disabled={isProcessing}>
                    {isProcessing ? "Processing..." : "Submit"}
                  </Button>
                  <audio
                    ref={audioRef}
                    src={URL.createObjectURL(audioBlob)}
                  />
                </div>
              ) : (
                <AudioRecorder
                  onRecordingComplete={handleRecordingComplete}
                  isProcessing={isProcessing}
                />
              )}
            </div>

            {lastAttempt && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      Score: {Math.round(lastAttempt.score * 100)}%
                    </span>
                    <Trophy className={`h-5 w-5 ${
                      lastAttempt.score >= 0.8 ? "text-yellow-500" : "text-gray-400"
                    }`} />
                  </div>
                  <Progress value={lastAttempt.score * 100} />
                </div>

                <div className="space-y-2">
                  {Object.entries(lastAttempt.feedback).map(([category, items]) => (
                    <div key={category}>
                      <h4 className="font-medium capitalize mb-1">{category}</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {items.map((item, index) => (
                          <li key={index} className="text-sm text-muted-foreground">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
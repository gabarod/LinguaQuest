import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Mic, MicOff, PlayCircle, StopCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SupportedLanguage } from "@db/schema";

interface PronunciationFeedback {
  score: number;
  feedback: string[];
  correctPhonemes: string[];
  incorrectPhonemes: string[];
}

interface Props {
  text: string;
  targetLanguage: SupportedLanguage;
}

export function PronunciationPractice({ text, targetLanguage }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const { toast } = useToast();

  // Obtener información del idioma
  const { data: language } = useQuery({
    queryKey: ["/api/languages", targetLanguage],
  });

  const analyzePronunciationMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("text", text);
      formData.append("language", targetLanguage);

      const response = await fetch("/api/pronunciation/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to analyze pronunciation");
      }

      return response.json() as Promise<PronunciationFeedback>;
    },
    onSuccess: (data) => {
      toast({
        title: "Análisis completado",
        description: `Puntuación: ${data.score}%`,
      });
    },
  });

  useEffect(() => {
    return () => {
      if (mediaRecorder.current && isRecording) {
        mediaRecorder.current.stop();
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
        setAudioBlob(audioBlob);
        analyzePronunciationMutation.mutate(audioBlob);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Error",
        description: "No se pudo acceder al micrófono",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Práctica de Pronunciación
          {language && (
            <Badge variant="outline" className="ml-2">
              {language.flag} {language.name}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-lg font-medium border-l-4 border-primary pl-4">
            {text}
          </div>

          <div className="flex justify-center gap-4">
            <Button
              variant={isRecording ? "destructive" : "default"}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={analyzePronunciationMutation.isPending}
            >
              {isRecording ? (
                <>
                  <StopCircle className="h-4 w-4 mr-2" />
                  Detener Grabación
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Iniciar Grabación
                </>
              )}
            </Button>
          </div>

          {analyzePronunciationMutation.data && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Precisión</p>
                <Progress
                  value={analyzePronunciationMutation.data.score}
                  className="h-2"
                />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Sugerencias</p>
                <ul className="space-y-2">
                  {analyzePronunciationMutation.data.feedback.map((feedback, index) => (
                    <li key={index} className="text-sm">• {feedback}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Fonemas</p>
                <div className="flex flex-wrap gap-2">
                  {analyzePronunciationMutation.data.correctPhonemes.map((phoneme, index) => (
                    <Badge key={index} variant="default">
                      {phoneme}
                    </Badge>
                  ))}
                  {analyzePronunciationMutation.data.incorrectPhonemes.map((phoneme, index) => (
                    <Badge key={index} variant="destructive">
                      {phoneme}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
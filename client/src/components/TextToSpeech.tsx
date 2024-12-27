import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TextToSpeechProps {
  text: string;
  language: string;
}

export function TextToSpeech({ text, language }: TextToSpeechProps) {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const { toast } = useToast();

  // Language code mapping
  const languageCodes: Record<string, string> = {
    english: 'en',
    spanish: 'es',
    french: 'fr',
    german: 'de',
    italian: 'it',
    portuguese: 'pt',
    chinese: 'zh',
    japanese: 'ja',
  };

  useEffect(() => {
    function loadVoices() {
      setVoices(window.speechSynthesis.getVoices());
    }

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const speak = () => {
    const langCode = languageCodes[language];
    if (!langCode) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Language not supported for text-to-speech",
      });
      return;
    }

    // Find voice for the language
    const availableVoices = voices.filter(voice => 
      voice.lang.toLowerCase().startsWith(langCode.toLowerCase())
    );

    if (availableVoices.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `No voice available for ${language}`,
      });
      return;
    }

    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = availableVoices[0];
    utterance.lang = langCode;
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to play audio",
      });
    };

    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  return (
    <Button 
      variant="ghost" 
      size="icon"
      onClick={speaking ? stop : speak}
      title={speaking ? "Stop speaking" : "Read text"}
    >
      {speaking ? (
        <VolumeX className="h-4 w-4" />
      ) : (
        <Volume2 className="h-4 w-4" />
      )}
    </Button>
  );
}
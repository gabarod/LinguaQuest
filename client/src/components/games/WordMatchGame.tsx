import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { GameEngine } from "./GameEngine";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { shuffleArray } from "@/lib/utils";

interface Word {
  id: number;
  word: string;
  translation: string;
}

interface WordMatchGameProps {
  words: Word[];
  onComplete: (score: number) => void;
}

export function WordMatchGame({ words, onComplete }: WordMatchGameProps) {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<number[]>([]);
  const [gameWords, setGameWords] = useState<(Word & { isTranslation: boolean })[]>([]);
  const { toast } = useToast();

  // Initialize game words
  useEffect(() => {
    const pairs = words.flatMap(word => [
      { ...word, isTranslation: false },
      { ...word, isTranslation: true }
    ]);
    setGameWords(shuffleArray(pairs));
  }, [words]);

  const handleCardClick = useCallback((index: number) => {
    if (matchedPairs.includes(index)) return;

    if (selectedCard === null) {
      setSelectedCard(index);
    } else {
      const firstCard = gameWords[selectedCard];
      const secondCard = gameWords[index];

      if (firstCard.id === secondCard.id && firstCard.isTranslation !== secondCard.isTranslation) {
        // Match found
        setMatchedPairs(prev => [...prev, selectedCard, index]);
        toast({
          title: "Match found!",
          description: "Great job! Keep going!",
        });
      } else {
        // No match
        setTimeout(() => {
          setSelectedCard(null);
        }, 1000);
        toast({
          variant: "destructive",
          title: "Not a match",
          description: "Try again!",
        });
      }
      setSelectedCard(null);
    }
  }, [selectedCard, gameWords, matchedPairs, toast]);

  const calculateScore = useCallback((matched: number[]) => {
    return (matched.length / 2) * 10;
  }, []);

  useEffect(() => {
    if (matchedPairs.length === gameWords.length) {
      const finalScore = calculateScore(matchedPairs);
      onComplete(finalScore);
    }
  }, [matchedPairs.length, gameWords.length, calculateScore, onComplete]);

  return (
    <GameEngine onScore={onComplete}>
      <div className="grid grid-cols-4 gap-4 mt-4">
        {gameWords.map((word, index) => (
          <motion.div
            key={`${index}-${word.id}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Card
              className={`
                h-24 flex items-center justify-center p-4 cursor-pointer
                ${matchedPairs.includes(index) ? 'bg-primary/20' : 'bg-card'}
                ${selectedCard === index ? 'ring-2 ring-primary' : ''}
              `}
              onClick={() => handleCardClick(index)}
            >
              <p className="text-center font-medium">
                {word.isTranslation ? word.translation : word.word}
              </p>
            </Card>
          </motion.div>
        ))}
      </div>
    </GameEngine>
  );
}

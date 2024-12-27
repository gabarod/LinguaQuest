import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gamepad2, Trophy } from "lucide-react";

interface GameEngineProps {
  width?: number;
  height?: number;
  onScore: (score: number) => void;
  children: React.ReactNode;
}

export function GameEngine({ 
  width = 600, 
  height = 400, 
  onScore, 
  children 
}: GameEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isPlaying) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up game loop
    let animationFrameId: number;
    const gameLoop = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Update game state
      if (gameOver) {
        cancelAnimationFrame(animationFrameId);
        onScore(currentScore);
        return;
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, gameOver, width, height, currentScore, onScore]);

  const startGame = () => {
    setIsPlaying(true);
    setGameOver(false);
    setCurrentScore(0);
  };

  const endGame = () => {
    setGameOver(true);
    setIsPlaying(false);
  };

  return (
    <Card className="p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="border rounded-lg bg-background"
          />
          
          <AnimatePresence>
            {!isPlaying && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-lg"
              >
                {gameOver ? (
                  <div className="text-center text-white">
                    <Trophy className="w-16 h-16 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold mb-2">Game Over!</h3>
                    <p className="mb-4">Final Score: {currentScore}</p>
                    <Button onClick={startGame}>Play Again</Button>
                  </div>
                ) : (
                  <div className="text-center text-white">
                    <Gamepad2 className="w-16 h-16 mx-auto mb-4" />
                    <Button onClick={startGame}>Start Game</Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isPlaying && (
          <div className="flex justify-between w-full">
            <div className="text-lg font-semibold">Score: {currentScore}</div>
            <Button variant="outline" onClick={endGame}>End Game</Button>
          </div>
        )}

        {children}
      </div>
    </Card>
  );
}

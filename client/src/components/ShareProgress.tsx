import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Share2, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface ProgressStats {
  totalPoints: number;
  lessonsCompleted: number;
  streak: number;
  weeklyProgress: Array<{
    day: string;
    points: number;
    exercises: number;
  }>;
  skillDistribution: Array<{
    skill: string;
    value: number;
  }>;
}

export function ShareProgress() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: progress } = useQuery<ProgressStats>({
    queryKey: ["/api/progress/detailed"],
  });

  const generateShareableCard = async () => {
    setIsGenerating(true);
    try {
      // Create a canvas element to draw our progress card
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx || !progress) return;

      canvas.width = 1200;
      canvas.height = 630;

      // Set background
      ctx.fillStyle = "hsl(var(--background))";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add gradient overlay
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "hsla(var(--primary), 0.1)");
      gradient.addColorStop(1, "hsla(var(--primary), 0.05)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add stats
      ctx.fillStyle = "hsl(var(--foreground))";
      ctx.font = "bold 48px system-ui";
      ctx.textAlign = "center";
      
      // Title
      ctx.fillText("My Language Learning Journey", canvas.width / 2, 100);

      // Stats
      ctx.font = "bold 72px system-ui";
      ctx.fillText(progress.totalPoints.toString(), canvas.width / 4, 250);
      ctx.font = "32px system-ui";
      ctx.fillText("Total Points", canvas.width / 4, 300);

      ctx.font = "bold 72px system-ui";
      ctx.fillText(progress.lessonsCompleted.toString(), canvas.width / 2, 250);
      ctx.font = "32px system-ui";
      ctx.fillText("Lessons Completed", canvas.width / 2, 300);

      ctx.font = "bold 72px system-ui";
      ctx.fillText(`${progress.streak} 🔥`, (3 * canvas.width) / 4, 250);
      ctx.font = "32px system-ui";
      ctx.fillText("Day Streak", (3 * canvas.width) / 4, 300);

      // Convert to image
      const imageUrl = canvas.toDataURL("image/png");

      // Try to share if Web Share API is available
      if (navigator.share) {
        const blob = await (await fetch(imageUrl)).blob();
        const file = new File([blob], "language-progress.png", { type: "image/png" });
        
        await navigator.share({
          title: "My Language Learning Progress",
          text: "Check out my language learning progress!",
          files: [file],
        });
      } else {
        // Fallback to download
        const link = document.createElement("a");
        link.download = "language-progress.png";
        link.href = imageUrl;
        link.click();
      }

      toast({
        title: "Progress card generated!",
        description: "Your progress has been saved as an image.",
      });
    } catch (error) {
      console.error("Error generating share card:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate progress card.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!progress) return null;

  return (
    <Card className="p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-6"
      >
        <h2 className="text-2xl font-bold">Share Your Progress</h2>
        <div className="grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold">{progress.totalPoints}</div>
            <div className="text-sm text-muted-foreground">Total Points</div>
          </div>
          <div>
            <div className="text-4xl font-bold">{progress.lessonsCompleted}</div>
            <div className="text-sm text-muted-foreground">Lessons Completed</div>
          </div>
          <div>
            <div className="text-4xl font-bold">{progress.streak} 🔥</div>
            <div className="text-sm text-muted-foreground">Day Streak</div>
          </div>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={generateShareableCard}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              "Generating..."
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Share Progress
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={generateShareableCard}
            disabled={isGenerating}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Image
          </Button>
        </div>
      </motion.div>
    </Card>
  );
}

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useProgress } from "@/hooks/use-progress";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Star, Award, Sparkles } from "lucide-react";
import { ShareAchievement } from "./ShareAchievement";
import confetti from 'canvas-confetti';

interface Milestone {
  id: number;
  title: string;
  description: string;
  type: string;
  points: number;
  icon: "trophy" | "star" | "award";
}

export function ProgressCelebration() {
  const { progress } = useProgress();
  const [showCelebration, setShowCelebration] = useState(false);
  const [currentMilestone, setCurrentMilestone] = useState<Milestone | null>(null);

  useEffect(() => {
    if (!progress) return;

    // Check for milestone achievements
    const newMilestones = checkMilestones(progress);
    if (newMilestones.length > 0) {
      setCurrentMilestone(newMilestones[0]);
      setShowCelebration(true);
      triggerCelebration();
    }
  }, [progress]);

  const checkMilestones = (progress: any): Milestone[] => {
    const milestones: Milestone[] = [];
    const { totalPoints, lessonsCompleted } = progress;

    // Point-based milestones
    if (totalPoints >= 1000 && !progress.achievements?.some((a: any) => a.id === 1)) {
      milestones.push({
        id: 1,
        title: "Point Master",
        description: "Earned 1000 points in your language learning journey!",
        type: "achievement",
        points: 100,
        icon: "trophy"
      });
    }

    // Lesson completion milestones
    if (lessonsCompleted >= 10 && !progress.achievements?.some((a: any) => a.id === 2)) {
      milestones.push({
        id: 2,
        title: "Dedicated Learner",
        description: "Completed 10 lessons! Keep up the great work!",
        type: "milestone",
        points: 50,
        icon: "star"
      });
    }

    return milestones;
  };

  const triggerCelebration = () => {
    // Trigger confetti animation
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const getIcon = (type: "trophy" | "star" | "award") => {
    switch (type) {
      case "trophy":
        return <Trophy className="h-16 w-16 text-yellow-500" />;
      case "star":
        return <Star className="h-16 w-16 text-blue-500" />;
      case "award":
        return <Award className="h-16 w-16 text-purple-500" />;
    }
  };

  return (
    <AnimatePresence>
      {showCelebration && currentMilestone && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6">
              <motion.div
                className="flex flex-col items-center text-center"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30
                }}
              >
                <motion.div
                  initial={{ rotate: -30, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                    delay: 0.2
                  }}
                >
                  {getIcon(currentMilestone.icon)}
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-4"
                >
                  <h2 className="text-2xl font-bold mb-2">{currentMilestone.title}</h2>
                  <p className="text-muted-foreground mb-4">{currentMilestone.description}</p>
                  <p className="text-xl font-semibold text-primary">
                    +{currentMilestone.points} Points!
                  </p>
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-6 space-y-4"
                >
                  <ShareAchievement
                    title={currentMilestone.title}
                    description={currentMilestone.description}
                    points={currentMilestone.points}
                    type={currentMilestone.type}
                  />
                  <button
                    onClick={() => setShowCelebration(false)}
                    className="block w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Continue Learning
                  </button>
                </motion.div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

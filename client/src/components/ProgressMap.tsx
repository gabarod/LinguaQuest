import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, Star, Trophy, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface Milestone {
  id: number;
  title: string;
  description: string;
  points: number;
  type: 'achievement' | 'skill' | 'challenge';
  unlocked: boolean;
  position: { x: number; y: number };
}

interface ProgressMapProps {
  milestones: Milestone[];
  currentProgress: number;
  onMilestoneClick: (milestone: Milestone) => void;
}

export function ProgressMap({ milestones, currentProgress, onMilestoneClick }: ProgressMapProps) {
  const pathVariants = {
    hidden: { pathLength: 0 },
    visible: {
      pathLength: currentProgress,
      transition: { duration: 2, ease: "easeInOut" }
    }
  };

  const milestoneVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: (custom: number) => ({
      scale: 1,
      opacity: 1,
      transition: { delay: custom * 0.2 }
    }),
    hover: { scale: 1.1, transition: { duration: 0.2 } }
  };

  return (
    <div className="relative w-full h-[600px] bg-background/95 rounded-lg p-6 overflow-hidden">
      {/* SVG Path connecting milestones */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <motion.path
          d="M100,500 Q200,450 300,400 T500,300 T700,200"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="4"
          initial="hidden"
          animate="visible"
          variants={pathVariants}
        />
      </svg>

      {/* Milestones */}
      <AnimatePresence>
        {milestones.map((milestone, index) => (
          <motion.div
            key={milestone.id}
            className="absolute"
            style={{
              left: `${milestone.position.x}%`,
              top: `${milestone.position.y}%`,
            }}
            initial="hidden"
            animate="visible"
            custom={index}
            variants={milestoneVariants}
            whileHover="hover"
          >
            <Button
              variant={milestone.unlocked ? "default" : "outline"}
              size="lg"
              className={cn(
                "relative rounded-full p-6",
                !milestone.unlocked && "opacity-50"
              )}
              onClick={() => onMilestoneClick(milestone)}
              disabled={!milestone.unlocked}
            >
              {getMilestoneIcon(milestone.type, milestone.unlocked)}
              
              <span className="sr-only">{milestone.title}</span>

              {/* Tooltip */}
              <Card className="absolute bottom-full mb-2 hidden group-hover:block w-48">
                <CardContent className="p-2">
                  <p className="font-semibold">{milestone.title}</p>
                  <p className="text-sm text-muted-foreground">{milestone.description}</p>
                  <Badge variant="secondary" className="mt-1">
                    {milestone.points} points
                  </Badge>
                </CardContent>
              </Card>
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function getMilestoneIcon(type: string, unlocked: boolean) {
  if (!unlocked) return <Lock className="h-6 w-6" />;
  
  switch (type) {
    case 'achievement':
      return <Trophy className="h-6 w-6" />;
    case 'skill':
      return <Star className="h-6 w-6" />;
    case 'challenge':
      return <Flag className="h-6 w-6" />;
    default:
      return <Unlock className="h-6 w-6" />;
  }
}

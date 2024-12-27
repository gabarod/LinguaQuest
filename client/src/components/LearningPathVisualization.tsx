import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Book, Star, Trophy, Zap, Brain, Target, ArrowRight, Lock } from "lucide-react";
import { useState } from "react";

interface LearningPathNode {
  id: number;
  title: string;
  type: string;
  status: "locked" | "available" | "completed" | "recommended";
  skillFocus: string[];
  difficulty: number;
  estimatedTime: number;
  prerequisites: number[];
  confidence: number;
}

interface AIRecommendation {
  id: number;
  type: string;
  priority: number;
  reason: string;
  metadata: {
    skillFocus: string[];
    estimatedTime: number;
    difficulty: number;
    prerequisites: number[];
  };
}

export function LearningPathVisualization() {
  const [selectedNode, setSelectedNode] = useState<LearningPathNode | null>(null);

  const { data: learningPath, isLoading: pathLoading } = useQuery<{
    nodes: LearningPathNode[];
    currentLevel: string;
    targetLevel: string;
    progress: number;
  }>({
    queryKey: ["/api/learning-path"],
  });

  const { data: recommendations, isLoading: recommendationsLoading } = useQuery<
    AIRecommendation[]
  >({
    queryKey: ["/api/recommendations"],
  });

  if (pathLoading || recommendationsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Brain className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  if (!learningPath) return null;

  const { nodes, currentLevel, targetLevel, progress } = learningPath;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Your Learning Journey</CardTitle>
              <CardDescription>
                From {currentLevel} to {targetLevel}
              </CardDescription>
            </div>
            <Progress value={progress} className="w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              <AnimatePresence>
                {nodes.map((node, index) => (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative"
                  >
                    <div
                      className={`absolute left-0 h-full w-0.5 -ml-2 ${
                        index === nodes.length - 1
                          ? "bg-gradient-to-b from-primary to-transparent"
                          : "bg-primary"
                      }`}
                    />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Card
                            className={`
                              relative cursor-pointer transition-all
                              ${
                                node.status === "locked"
                                  ? "opacity-50"
                                  : "hover:scale-[1.02]"
                              }
                              ${
                                node.status === "recommended"
                                  ? "border-primary/50 bg-primary/5"
                                  : ""
                              }
                            `}
                            onClick={() => setSelectedNode(node)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center gap-4">
                                {node.status === "completed" ? (
                                  <Trophy className="w-6 h-6 text-green-500" />
                                ) : node.status === "recommended" ? (
                                  <Zap className="w-6 h-6 text-primary animate-pulse" />
                                ) : node.status === "available" ? (
                                  <Book className="w-6 h-6 text-blue-500" />
                                ) : (
                                  <Lock className="w-6 h-6 text-gray-400" />
                                )}
                                <div className="flex-1">
                                  <h4 className="font-medium">{node.title}</h4>
                                  <div className="flex gap-2 mt-2">
                                    {node.skillFocus.map((skill) => (
                                      <Badge
                                        key={skill}
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {skill}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <div className="flex items-center gap-1">
                                    <Star className="w-4 h-4 text-yellow-500" />
                                    <span className="text-sm">
                                      {node.difficulty.toFixed(1)}
                                    </span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {node.estimatedTime}min
                                  </span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </CardContent>
                          </Card>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Confidence: {(node.confidence * 100).toFixed(0)}%</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {recommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recommendations.map((rec) => (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <Target className="w-5 h-5 text-primary mt-1" />
                    <div className="flex-1">
                      <h4 className="font-medium">
                        Priority {rec.priority}: {rec.type}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {rec.reason}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {rec.metadata.skillFocus.map((skill) => (
                          <Badge
                            key={skill}
                            variant="outline"
                            className="text-xs"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button variant="secondary" size="sm">
                      Start
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
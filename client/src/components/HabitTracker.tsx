import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Flame, Trophy, Target } from "lucide-react";

interface HabitStats {
  streak: number;
  lastActivity: string;
  weeklyXP: number;
  monthlyXP: number;
  completedChallenges: number;
}

export function HabitTracker() {
  const { data: stats, isLoading } = useQuery<HabitStats>({
    queryKey: ["/api/leaderboard/user/stats"],
  });

  const today = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, i);
    return format(date, 'EEE');
  }).reverse();

  const getStreakColor = (streak: number) => {
    if (streak >= 30) return "text-purple-500";
    if (streak >= 14) return "text-blue-500";
    if (streak >= 7) return "text-green-500";
    return "text-orange-500";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Seguimiento de Hábitos</CardTitle>
        <CardDescription>
          Mantén tu racha de aprendizaje y gana recompensas diarias
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Calendar className="h-8 w-8 animate-pulse text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Streak Section */}
            <div className="flex items-center justify-between">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-2"
              >
                <Flame className={`h-6 w-6 ${getStreakColor(stats?.streak ?? 0)}`} />
                <div>
                  <h4 className="font-semibold">{stats?.streak ?? 0} días</h4>
                  <p className="text-sm text-muted-foreground">Racha actual</p>
                </div>
              </motion.div>
              <Badge variant="secondary" className="px-2 py-1">
                <Trophy className="h-4 w-4 mr-1" />
                {stats?.completedChallenges ?? 0} desafíos
              </Badge>
            </div>

            {/* Weekly Activity */}
            <div>
              <h4 className="font-semibold mb-3">Actividad Semanal</h4>
              <div className="grid grid-cols-7 gap-1">
                {last7Days.map((day, index) => (
                  <motion.div
                    key={day}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex flex-col items-center"
                  >
                    <div className="text-xs text-muted-foreground mb-1">{day}</div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      index === 6 ? 'bg-primary/20' : 'bg-muted'
                    }`}>
                      <Target className="h-4 w-4" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* XP Progress */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <h4 className="font-semibold text-lg">{stats?.weeklyXP ?? 0}</h4>
                <p className="text-sm text-muted-foreground">XP Semanal</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <h4 className="font-semibold text-lg">{stats?.monthlyXP ?? 0}</h4>
                <p className="text-sm text-muted-foreground">XP Mensual</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
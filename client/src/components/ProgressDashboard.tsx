import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import { HabitTracker } from "./HabitTracker";
import { ProgressMap } from "./ProgressMap";
import { format } from "date-fns";
import { useMilestones } from "@/hooks/use-milestones";

interface ProgressStats {
  weeklyProgress: {
    date: string;
    points: number;
    lessonsCompleted: number;
  }[];
  skillDistribution: {
    name: string;
    value: number;
  }[];
  totalPoints: number;
  accuracy: number;
  streak: number;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export function ProgressDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<ProgressStats>({
    queryKey: ["/api/progress/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { milestones, isLoading: milestonesLoading } = useMilestones();

  if (statsLoading || milestonesLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Calculate progress as percentage of completed milestones
  const completedMilestones = milestones?.filter(m => m.unlocked)?.length || 0;
  const totalMilestones = milestones?.length || 1;
  const progressPercentage = completedMilestones / totalMilestones;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="habits">Habits</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.weeklyProgress}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => format(new Date(date), "MMM d")}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(date) => format(new Date(date), "MMMM d, yyyy")}
                    />
                    <Line
                      type="monotone"
                      dataKey="points"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Skill Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.skillDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {stats.skillDistribution.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Achievement Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <ProgressMap
                    milestones={milestones || []}
                    currentProgress={progressPercentage}
                    onMilestoneClick={(milestone) => {
                      if (!milestone.unlocked) return;
                      // TODO: Show milestone details in a modal
                    }}
                  />
                </motion.div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="achievements">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {milestones?.map((milestone) => (
              <Card
                key={milestone.id}
                className={`relative overflow-hidden transition-all duration-300 ${
                  milestone.unlocked
                    ? "bg-primary/5 border-primary/20"
                    : "opacity-75"
                }`}
              >
                <CardContent className="pt-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-center"
                  >
                    <div className="mb-4">
                      {milestone.unlocked ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30,
                          }}
                          className="inline-block p-3 rounded-full bg-primary/10"
                        >
                          {/* Icon based on milestone type */}
                          <div className="h-8 w-8 text-primary" />
                        </motion.div>
                      ) : (
                        <div className="inline-block p-3 rounded-full bg-muted">
                          <div className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <h3 className="font-semibold mb-2">{milestone.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {milestone.description}
                    </p>
                    {milestone.unlockedAt && (
                      <p className="text-xs text-muted-foreground">
                        Unlocked on{" "}
                        {format(new Date(milestone.unlockedAt), "MMMM d, yyyy")}
                      </p>
                    )}
                  </motion.div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="habits">
          <HabitTracker />
        </TabsContent>
      </Tabs>
    </div>
  );
}
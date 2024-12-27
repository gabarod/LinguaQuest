import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Trophy, Medal, Timer, Crown, Target } from "lucide-react";
import { useUser } from "@/hooks/use-user";

interface LeaderboardEntry {
  id: number;
  username: string;
  totalPoints: number;
  weeklyXP: number;
  monthlyXP: number;
  streak: number;
  globalRank: number;
}

interface RankingStats {
  globalRank: number;
  weeklyRank: number;
  monthlyRank: number;
  totalPoints: number;
  weeklyXP: number;
  monthlyXP: number;
}

export default function LeaderboardPage() {
  const { user } = useUser();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [period, setPeriod] = useState<"global" | "weekly" | "monthly">("global");

  // Fetch initial leaderboard data
  const { data: leaderboard = [], refetch: refetchLeaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: [`/api/leaderboard/${period}`],
  });

  // Fetch user's ranking stats
  const { data: userStats } = useQuery<RankingStats>({
    queryKey: ["/api/leaderboard/user/stats"],
    enabled: !!user,
  });

  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/leaderboard/live`;
    const websocket = new WebSocket(wsUrl);

    websocket.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.type === 'leaderboard_update') {
        refetchLeaderboard();
      }
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [refetchLeaderboard]);

  const getRankDisplay = (rank: number) => {
    if (rank <= 3) {
      return (
        <div className="flex items-center gap-2">
          {rank === 1 && <Crown className="h-5 w-5 text-yellow-500" />}
          {rank === 2 && <Medal className="h-5 w-5 text-gray-400" />}
          {rank === 3 && <Medal className="h-5 w-5 text-amber-600" />}
          <span>{rank}</span>
        </div>
      );
    }
    return rank;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto p-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Language Learning Rankings</h1>
          <p className="text-muted-foreground">
            Compete with learners worldwide and track your progress!
          </p>
        </div>

        {userStats && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Your Rankings</CardTitle>
              <CardDescription>Your current position across different timeframes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center p-4 bg-primary/5 rounded-lg"
                >
                  <Trophy className="h-8 w-8 text-primary mb-2" />
                  <span className="text-sm text-muted-foreground">Global Rank</span>
                  <span className="text-2xl font-bold">{getRankDisplay(userStats.globalRank)}</span>
                  <span className="text-sm text-muted-foreground">{userStats.totalPoints} Points</span>
                </motion.div>
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="flex flex-col items-center p-4 bg-primary/5 rounded-lg"
                >
                  <Timer className="h-8 w-8 text-primary mb-2" />
                  <span className="text-sm text-muted-foreground">Weekly Rank</span>
                  <span className="text-2xl font-bold">{getRankDisplay(userStats.weeklyRank)}</span>
                  <span className="text-sm text-muted-foreground">{userStats.weeklyXP} XP</span>
                </motion.div>
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col items-center p-4 bg-primary/5 rounded-lg"
                >
                  <Target className="h-8 w-8 text-primary mb-2" />
                  <span className="text-sm text-muted-foreground">Monthly Rank</span>
                  <span className="text-2xl font-bold">{getRankDisplay(userStats.monthlyRank)}</span>
                  <span className="text-sm text-muted-foreground">{userStats.monthlyXP} XP</span>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={period} onValueChange={(value) => setPeriod(value as typeof period)}>
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="global">Global</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={period}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="space-y-4">
                {leaderboard.map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className={entry.id === user?.id ? "border-primary" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-2xl font-bold w-12">
                              {getRankDisplay(index + 1)}
                            </div>
                            <div>
                              <h3 className="font-medium">{entry.username}</h3>
                              <p className="text-sm text-muted-foreground">
                                {period === "global" && `${entry.totalPoints} Total Points`}
                                {period === "weekly" && `${entry.weeklyXP} Weekly XP`}
                                {period === "monthly" && `${entry.monthlyXP} Monthly XP`}
                              </p>
                            </div>
                          </div>
                          <div className="text-sm">
                            {entry.streak} Day Streak
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </main>
    </div>
  );
}

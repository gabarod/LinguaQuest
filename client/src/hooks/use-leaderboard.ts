import { useQuery } from "@tanstack/react-query";

interface LeaderboardEntry {
  id: number;
  username: string;
  totalPoints: number;
  weeklyXP: number;
  monthlyXP: number;
  streak: number;
  globalRank: number;
  isCurrentUser?: boolean;
}

interface UserStats {
  globalRank: number;
  weeklyRank: number;
  monthlyRank: number;
  totalPoints: number;
  weeklyXP: number;
  monthlyXP: number;
}

export function useLeaderboard() {
  const { data: globalLeaderboard, isLoading: isGlobalLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard/global"],
  });

  const { data: weeklyLeaderboard, isLoading: isWeeklyLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard/weekly"],
  });

  const { data: monthlyLeaderboard, isLoading: isMonthlyLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard/monthly"],
  });

  const { data: userStats, isLoading: isUserStatsLoading } = useQuery<UserStats>({
    queryKey: ["/api/leaderboard/user/stats"],
  });

  return {
    globalLeaderboard,
    weeklyLeaderboard,
    monthlyLeaderboard,
    userStats,
    isLoading: isGlobalLoading || isWeeklyLoading || isMonthlyLoading || isUserStatsLoading,
  };
}

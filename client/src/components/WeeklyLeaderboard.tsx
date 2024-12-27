import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Award, Star } from "lucide-react";
import { useUser } from "@/hooks/use-user";

interface LeaderboardEntry {
  id: number;
  username: string;
  weeklyXP: number;
  weeklyRank: number;
  challengesCompleted: number;
  averageScore: number;
}

export function WeeklyLeaderboard() {
  const { user } = useUser();
  const { data: leaderboard, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard/weekly-challenge"],
    refetchInterval: 60000, // Refresh every minute
  });

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "text-yellow-500";
      case 2:
        return "text-gray-400";
      case 3:
        return "text-amber-600";
      default:
        return "text-slate-700";
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Trophy className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Trophy className="h-6 w-6 text-amber-600" />;
      default:
        return <Star className="h-5 w-5 text-slate-700" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Desafíos Semanales
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-pulse text-muted-foreground">
              Cargando clasificación...
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {leaderboard?.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  entry.id === user?.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-accent"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getRankIcon(entry.weeklyRank)}
                    <span
                      className={`font-bold ${getRankColor(entry.weeklyRank)}`}
                    >
                      #{entry.weeklyRank}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{entry.username}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.challengesCompleted} desafíos completados
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{entry.weeklyXP} XP</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(entry.averageScore)}% precisión
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
}

interface Challenge {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  points: number;
  questions: Question[];
  completed: boolean;
  score?: number;
  availableFrom: string;
  availableUntil: string;
}

interface LeaderboardEntry {
  username: string;
  score: number;
  completedAt: string;
}

export function useDailyChallenge() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: challenge, isLoading } = useQuery<Challenge>({
    queryKey: ["/api/challenges/daily"],
  });

  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: [`/api/challenges/${challenge?.id}/leaderboard`],
    enabled: !!challenge?.id,
  });

  const submitAttemptMutation = useMutation({
    mutationFn: async ({ challengeId, answers }: { challengeId: number; answers: string[] }) => {
      const response = await fetch(`/api/challenges/${challengeId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/daily"] });
      queryClient.invalidateQueries({ queryKey: [`/api/challenges/${challenge?.id}/leaderboard`] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });

      toast({
        title: "Challenge Completed!",
        description: `You scored ${data.score} points!`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to submit challenge",
        description: error.message,
      });
    },
  });

  return {
    challenge,
    leaderboard,
    isLoading,
    submitAttempt: submitAttemptMutation.mutateAsync,
  };
}

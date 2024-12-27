import { useQuery } from "@tanstack/react-query";

interface WeeklyProgress {
  day: string;
  points: number;
  exercises: number;
}

interface SkillDistribution {
  skill: string;
  value: number;
}

interface ProgressData {
  weeklyProgress: WeeklyProgress[];
  skillDistribution: SkillDistribution[];
  totalPoints: number;
  lessonsCompleted: number;
  streak: number;
}

export function useProgress() {
  const { data: progress, error, isLoading } = useQuery<ProgressData>({
    queryKey: ["/api/progress/detailed"],
  });

  return {
    progress,
    error,
    isLoading,
  };
}

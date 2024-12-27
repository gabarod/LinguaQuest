import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Milestone {
  id: number;
  title: string;
  description: string;
  type: "achievement" | "skill" | "challenge";
  points: number;
  position: { x: number; y: number };
  requiredLessons: number;
  requiredPoints: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export function useMilestones() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: milestones, isLoading } = useQuery<Milestone[]>({
    queryKey: ["/api/milestones"],
  });

  const unlockMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: number) => {
      const response = await fetch(`/api/milestones/${milestoneId}/unlock`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
      toast({
        title: "Milestone Unlocked!",
        description: "Congratulations on reaching this achievement!",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to unlock milestone",
        description: error.message,
      });
    },
  });

  return {
    milestones,
    isLoading,
    unlockMilestone: unlockMilestoneMutation.mutateAsync,
  };
}

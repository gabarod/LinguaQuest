import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Lesson, Exercise, UserProgress } from "@/types";

export function useLesson(lessonId?: number) {
  const queryClient = useQueryClient();

  const { data: lessons } = useQuery<Lesson[]>({
    queryKey: ["/api/lessons"],
  });

  const { data: progress } = useQuery<UserProgress>({
    queryKey: ["/api/progress"],
  });

  const { data: lesson } = useQuery<Lesson>({
    queryKey: [`/api/lessons/${lessonId}`],
    enabled: !!lessonId,
  });

  const { data: exercises } = useQuery<Exercise[]>({
    queryKey: [`/api/lessons/${lessonId}/exercises`],
    enabled: !!lessonId,
  });

  const completeLessonMutation = useMutation({
    mutationFn: async (lessonId: number) => {
      const response = await fetch(`/api/lessons/${lessonId}/complete`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to complete lesson");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
    },
  });

  return {
    lessons,
    progress,
    lesson,
    exercises,
    completeLesson: completeLessonMutation.mutateAsync,
  };
}

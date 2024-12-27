import { useUser } from "@/hooks/use-user";
import { useLesson } from "@/hooks/use-lesson";
import { useProgress } from "@/hooks/use-progress";
import { Navigation } from "@/components/Navigation";
import { LessonCard } from "@/components/LessonCard";
import { ProgressBar } from "@/components/ProgressBar";
import { ProgressChart } from "@/components/ProgressChart";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import type { Lesson } from "@/types";

export default function HomePage() {
  const { user } = useUser();
  const { lessons } = useLesson();
  const { progress, isLoading } = useProgress();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto p-4 pb-24">
        <section className="mb-8">
          <h1 className="text-2xl font-bold mb-4">Welcome back, {user?.username}!</h1>
          <ProgressBar
            completed={progress?.lessonsCompleted || 0}
            total={lessons?.length || 0}
            streak={progress?.streak || 0}
          />
        </section>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Your Progress</h2>
            {progress && (
              <ProgressChart
                weeklyProgress={progress.weeklyProgress}
                skillDistribution={progress.skillDistribution}
              />
            )}
          </section>
        )}

        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Continue Learning</h2>
            <Button
              variant="ghost"
              onClick={() => setLocation("/lessons")}
            >
              See All
            </Button>
          </div>

          <ScrollArea className="h-[400px] w-full rounded-md border p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lessons?.map((lesson: Lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  onClick={() => setLocation(`/lesson/${lesson.id}`)}
                />
              ))}
            </div>
          </ScrollArea>
        </section>
      </main>
    </div>
  );
}
import { useUser } from "@/hooks/use-user";
import { useLesson } from "@/hooks/use-lesson";
import { Navigation } from "@/components/Navigation";
import { LessonCard } from "@/components/LessonCard";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";

export default function HomePage() {
  const { user } = useUser();
  const { lessons, progress } = useLesson();
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
              {lessons?.map((lesson) => (
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
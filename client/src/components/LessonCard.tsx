import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type Lesson } from "@/types";
import { Book, Headphones, MessageSquare, Pen } from "lucide-react";

const typeIcons: Record<string, any> = {
  speaking: MessageSquare,
  reading: Book,
  writing: Pen,
  listening: Headphones,
};

interface LessonCardProps {
  lesson: Lesson;
  onClick: () => void;
}

export function LessonCard({ lesson, onClick }: LessonCardProps) {
  const Icon = typeIcons[lesson.type] || Book;

  return (
    <Card 
      className={`cursor-pointer transition-transform hover:scale-105 ${
        lesson.completed ? "bg-muted" : ""
      }`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {lesson.title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-2">
          {lesson.description}
        </p>
        <div className="flex gap-2">
          <Badge variant="outline">{lesson.level}</Badge>
          <Badge variant="secondary">{lesson.points} points</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Flame } from "lucide-react";

interface ProgressBarProps {
  completed: number;
  total: number;
  streak: number;
}

export function ProgressBar({ completed, total, streak }: ProgressBarProps) {
  const percentage = Math.round((completed / total) * 100);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-medium">Progress</h3>
            <p className="text-2xl font-bold">{percentage}%</p>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <span className="text-xl font-bold">{streak}</span>
          </div>
        </div>
        <Progress value={percentage} className="h-2" />
        <p className="text-sm text-muted-foreground mt-2">
          {completed} of {total} lessons completed
        </p>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Timer, Lock, Unlock } from "lucide-react";
import { formatDuration } from "date-fns";

interface CountdownTimerProps {
  expiresAt: Date;
  onExpire?: () => void;
}

export function CountdownTimer({ expiresAt, onExpire }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<Duration>({});
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    function calculateTimeLeft() {
      const difference = new Date(expiresAt).getTime() - new Date().getTime();
      
      if (difference <= 0) {
        setIsExpired(true);
        onExpire?.();
        return;
      }

      const timeLeftObj = {
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };

      setTimeLeft(timeLeftObj);
    }

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <span className="font-medium">
              {isExpired ? "Challenge Expired" : "Time Remaining"}
            </span>
          </div>
          {isExpired ? (
            <Lock className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Unlock className="h-5 w-5 text-primary" />
          )}
        </div>

        {!isExpired && (
          <div className="mt-4 text-3xl font-mono font-bold text-center text-primary">
            {timeLeft.hours?.toString().padStart(2, '0')}:
            {timeLeft.minutes?.toString().padStart(2, '0')}:
            {timeLeft.seconds?.toString().padStart(2, '0')}
          </div>
        )}

        {isExpired && (
          <p className="mt-4 text-center text-muted-foreground">
            Next challenge will be available soon!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

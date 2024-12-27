import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock, MessageSquare } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface PracticeSession {
  id: number;
  participantId: number;
  participantName: string;
  language: string;
  scheduledFor: string;
  duration: number;
  topic?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export function PracticeSessions() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(30);

  const { data: sessions, isLoading } = useQuery<PracticeSession[]>({
    queryKey: ["/api/practice-sessions/upcoming"],
  });

  const scheduleMutation = useMutation({
    mutationFn: async (participantId: number) => {
      const response = await fetch("/api/practice-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          scheduledFor: selectedDate?.toISOString(),
          duration,
          topic,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sesión programada",
        description: "Tu sesión de práctica ha sido programada exitosamente.",
      });
    },
  });

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold mb-4">Sesiones Próximas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions?.map((session) => (
            <Card key={session.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Sesión con {session.participantName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    <span>{format(new Date(session.scheduledFor), "PPP")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{session.duration} minutos</span>
                  </div>
                  {session.topic && (
                    <p className="text-sm text-muted-foreground">
                      Tema: {session.topic}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => {
                      // Handle joining session
                    }}
                  >
                    Unirse a la sesión
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Programar Nueva Sesión</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Fecha y Hora</label>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Duración (minutos)</label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  min={15}
                  max={120}
                  step={15}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Tema (opcional)</label>
                <Textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="¿Sobre qué te gustaría practicar?"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

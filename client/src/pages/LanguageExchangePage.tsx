import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Users, Calendar, MessageSquare } from "lucide-react";
import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface BuddyProfile {
  id: number;
  username: string;
  nativeLanguage: string;
  learningLanguage: string;
  proficiencyLevel: string;
  availability: string[];
}

export default function LanguageExchangePage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [selectedLanguage, setSelectedLanguage] = useState("spanish");

  const { data: potentialBuddies, isLoading } = useQuery<BuddyProfile[]>({
    queryKey: [`/api/buddies/potential`, { language: selectedLanguage }],
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (buddyId: number) => {
      const response = await fetch("/api/buddies/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buddyId,
          language: selectedLanguage
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "¡Solicitud enviada!",
        description: "Se ha enviado tu solicitud de intercambio de idiomas.",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto p-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Intercambio de Idiomas</h1>
          <p className="text-muted-foreground">
            Encuentra compañeros de práctica para mejorar tus habilidades lingüísticas
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {potentialBuddies?.map((buddy) => (
              <Card key={buddy.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {buddy.username}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Idioma nativo</p>
                      <p className="font-medium">{buddy.nativeLanguage}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Aprendiendo</p>
                      <p className="font-medium">{buddy.learningLanguage}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Nivel</p>
                      <p className="font-medium">{buddy.proficiencyLevel}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Disponibilidad</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {buddy.availability.map((time) => (
                          <span
                            key={time}
                            className="text-xs bg-accent px-2 py-1 rounded-full"
                          >
                            {time}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => sendRequestMutation.mutate(buddy.id)}
                      disabled={sendRequestMutation.isPending}
                    >
                      {sendRequestMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Enviar solicitud"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

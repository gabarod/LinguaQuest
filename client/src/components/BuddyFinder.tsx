import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BuddyProfile {
  id: number;
  username: string;
  targetLanguage: string;
  nativeLanguage: string;
  proficiencyLevel: string;
  lastActive: string;
}

export function BuddyFinder() {
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: potentialBuddies, isLoading } = useQuery<BuddyProfile[]>({
    queryKey: ["/api/buddies/potential", selectedLanguage],
    enabled: !!selectedLanguage,
  });

  const sendRequest = useMutation({
    mutationFn: async (buddyId: number) => {
      const response = await fetch("/api/buddies/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buddyId, language: selectedLanguage }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Request Sent!",
        description: "Your buddy request has been sent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/buddies/potential"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send request",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Find Language Exchange Partners
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex gap-4 items-center">
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spanish">Spanish</SelectItem>
                <SelectItem value="french">French</SelectItem>
                <SelectItem value="german">German</SelectItem>
                <SelectItem value="italian">Italian</SelectItem>
                <SelectItem value="portuguese">Portuguese</SelectItem>
                <SelectItem value="japanese">Japanese</SelectItem>
                <SelectItem value="korean">Korean</SelectItem>
                <SelectItem value="mandarin">Mandarin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedLanguage && (
            <div className="grid gap-4 md:grid-cols-2">
              {potentialBuddies?.map((buddy) => (
                <Card key={buddy.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{buddy.username}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Native: {buddy.nativeLanguage}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Learning: {buddy.targetLanguage} ({buddy.proficiencyLevel})
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => sendRequest.mutate(buddy.id)}
                        disabled={sendRequest.isPending}
                      >
                        {sendRequest.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {potentialBuddies?.length === 0 && (
                <p className="text-muted-foreground text-sm col-span-2 text-center py-8">
                  No language partners found for {selectedLanguage}. Try another language or check back later!
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

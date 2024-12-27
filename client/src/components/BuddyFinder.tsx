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
import { Loader2, UserPlus, Users, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface BuddyProfile {
  id: number;
  username: string;
  preferences?: {
    vocabulary: number;
    grammar: number;
    pronunciation: number;
    comprehension: number;
  };
  matchScore: number;
  matchReasons: string[];
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
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{buddy.username}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm text-muted-foreground">
                              {Math.round(buddy.matchScore)}% Match
                            </span>
                          </div>
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

                      <Progress value={buddy.matchScore} className="h-2" />

                      {buddy.preferences && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Skill Levels:</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(buddy.preferences).map(([skill, level]) => (
                              <div key={skill} className="flex justify-between">
                                <span className="capitalize">{skill}:</span>
                                <span className="text-muted-foreground">{level}/5</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-sm font-medium">Why you match:</p>
                        <div className="flex flex-wrap gap-1">
                          {buddy.matchReasons.map((reason) => (
                            <span
                              key={reason}
                              className="text-xs bg-accent px-2 py-1 rounded-full"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>
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
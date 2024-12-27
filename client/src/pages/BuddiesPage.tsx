import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supportedLanguages } from "@db/schema";
import { MessageCircle, Languages, Users } from "lucide-react";
import { LanguageExchangeCall } from "@/components/LanguageExchangeCall";

interface LanguageBuddy {
  id: number;
  username: string;
  nativeLanguage: string;
  targetLanguage: string;
  lastActive: Date;
  interests: string[];
}

export default function BuddiesPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>();
  const [selectedCall, setSelectedCall] = useState<LanguageBuddy | null>(null);

  const { data: buddies = [], isLoading } = useQuery<LanguageBuddy[]>({
    queryKey: ["/api/buddies", selectedLanguage],
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Find Language Partners</h1>
              <p className="text-muted-foreground">
                Connect with native speakers and practice together
              </p>
            </div>
            <Select
              value={selectedLanguage}
              onValueChange={setSelectedLanguage}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by language" />
              </SelectTrigger>
              <SelectContent>
                {supportedLanguages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {buddies.map((buddy) => (
              <Card key={buddy.id}>
                <CardHeader className="flex flex-row items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>
                      {buddy.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle>{buddy.username}</CardTitle>
                    <CardDescription>
                      Last active: {new Date(buddy.lastActive).toLocaleDateString()}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Languages className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Native: {buddy.nativeLanguage}
                        {" • "}
                        Learning: {buddy.targetLanguage}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {buddy.interests.map((interest) => (
                        <Badge key={interest} variant="secondary">
                          {interest}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setSelectedCall(buddy)}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Call
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <Users className="h-4 w-4 mr-2" />
                        Profile
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {selectedCall && (
        <LanguageExchangeCall
          userId={selectedCall.id}
          targetLanguage={selectedCall.targetLanguage}
          nativeLanguage={selectedCall.nativeLanguage}
          onClose={() => setSelectedCall(null)}
        />
      )}
    </div>
  );
}

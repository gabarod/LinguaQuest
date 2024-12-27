import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { ChatInterface } from "@/components/ChatInterface";
import { BuddyFinder } from "@/components/BuddyFinder";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";

export default function LanguageExchangePage() {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto p-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Language Exchange</h1>
          <p className="text-muted-foreground">
            Practice with AI or find language exchange partners to improve your skills
          </p>
        </div>

        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList>
            <TabsTrigger value="chat">Practice Chat</TabsTrigger>
            <TabsTrigger value="buddies">Find Partners</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            <ChatInterface />
          </TabsContent>

          <TabsContent value="buddies" className="space-y-4">
            <BuddyFinder />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
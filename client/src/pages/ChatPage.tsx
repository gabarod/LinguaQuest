import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useUser } from "@/hooks/use-user";
import { TextToSpeech } from "@/components/TextToSpeech";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useUser();

  const { data: messages = [], isLoading, refetch } = useQuery<Message[]>({
    queryKey: ["/api/chat/messages"],
    enabled: !!user,
  });

  useEffect(() => {
    if (messages.length > 0) {
      setLocalMessages(messages);
    }
  }, [messages]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [localMessages]);

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (response) => {
      setLocalMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "user",
          content: input,
          timestamp: new Date(),
        },
        {
          id: response.id,
          role: "assistant",
          content: response.content,
          timestamp: new Date(response.timestamp),
        },
      ]);
      setInput("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage.mutate(input);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto p-4">
        <Card className="max-w-4xl mx-auto">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Practice Chat</CardTitle>
            <LanguageSelector />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col h-[600px]">
              <ScrollArea 
                className="flex-1 pr-4"
                ref={scrollAreaRef}
              >
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {localMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex items-start gap-3 ${
                          message.role === "user" ? "flex-row-reverse" : ""
                        }`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {message.role === "user" ? "U" : "A"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-start gap-2">
                          <div
                            className={`rounded-lg p-3 max-w-[80%] ${
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            {message.content}
                          </div>
                          {message.role === "assistant" && (
                            <TextToSpeech 
                              text={message.content}
                              language={user?.targetLanguage || 'english'}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    {sendMessage.isPending && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Typing...</span>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  disabled={sendMessage.isPending}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={sendMessage.isPending || !input.trim()}
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
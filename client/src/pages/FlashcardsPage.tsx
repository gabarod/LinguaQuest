import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlashcardGenerator } from "@/components/FlashcardGenerator";
import { FlashcardView } from "@/components/FlashcardView";

export function FlashcardsPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Flashcards</h1>

      <Tabs defaultValue="study" className="space-y-6">
        <TabsList>
          <TabsTrigger value="study">Study</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
        </TabsList>

        <TabsContent value="study">
          <FlashcardView />
        </TabsContent>

        <TabsContent value="create">
          <FlashcardGenerator />
        </TabsContent>
      </Tabs>
    </div>
  );
}

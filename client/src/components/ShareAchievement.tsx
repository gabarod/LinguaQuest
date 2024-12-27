import { Share2, Twitter, Facebook, Linkedin } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface ShareAchievementProps {
  title: string;
  description: string;
  points: number;
  type: string;
}

export function ShareAchievement({ title, description, points, type }: ShareAchievementProps) {
  const shareData = {
    text: `I just earned ${points} points in ${type} on LinguaQuest! 🎉\n${description}`,
    url: window.location.href,
  };

  const handleShare = async (platform?: string) => {
    try {
      if (!platform && navigator.share) {
        await navigator.share({
          title: "My Language Learning Achievement",
          text: shareData.text,
          url: shareData.url,
        });
        toast({
          title: "Shared successfully!",
          description: "Your achievement has been shared.",
        });
        return;
      }

      // Platform-specific sharing
      let platformUrl = "";
      switch (platform) {
        case "twitter":
          platformUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            shareData.text
          )}&url=${encodeURIComponent(shareData.url)}`;
          break;
        case "facebook":
          platformUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            shareData.url
          )}&quote=${encodeURIComponent(shareData.text)}`;
          break;
        case "linkedin":
          platformUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
            shareData.url
          )}`;
          break;
      }

      if (platformUrl) {
        window.open(platformUrl, "_blank", "width=600,height=400");
        toast({
          title: "Opening share dialog",
          description: `Sharing to ${platform}...`,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to share",
        description: "There was an error sharing your achievement.",
      });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Share Achievement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Achievement</DialogTitle>
          <DialogDescription>
            Share your language learning progress with friends!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center justify-between p-4 bg-primary/5 rounded-lg"
              >
                <span className="text-sm font-medium">{points} Points Earned</span>
                <span className="text-sm text-muted-foreground">{type}</span>
              </motion.div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleShare("twitter")}
            >
              <Twitter className="h-4 w-4" />
              Share on Twitter
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleShare("facebook")}
            >
              <Facebook className="h-4 w-4" />
              Share on Facebook
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleShare("linkedin")}
            >
              <Linkedin className="h-4 w-4" />
              Share on LinkedIn
            </Button>
            <Button
              variant="default"
              className="gap-2"
              onClick={() => handleShare()}
            >
              <Share2 className="h-4 w-4" />
              Share via...
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
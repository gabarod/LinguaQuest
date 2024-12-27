import { Share2, Twitter, Facebook, Linkedin, Trophy, Star, Award } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
import { Badge } from "@/components/ui/badge";

interface ShareAchievementProps {
  title: string;
  description: string;
  points: number;
  type: string;
}

export function ShareAchievement({ title, description, points, type }: ShareAchievementProps) {
  const shareData = {
    text: `🎉 Achievement Unlocked! 🌟\nI just earned ${points} points in ${type} on LinguaQuest!\n${description}\n#LanguageLearning #Achievement`,
    url: window.location.href,
  };

  const handleShare = async (platform?: string) => {
    try {
      if (!platform && navigator.share) {
        await navigator.share({
          title: "Language Learning Achievement",
          text: shareData.text,
          url: shareData.url,
        });
        toast({
          title: "Shared successfully!",
          description: "Your achievement has been shared with your friends.",
        });
        return;
      }

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
          description: `Sharing your achievement on ${platform}...`,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to share",
        description: "There was an error sharing your achievement. Please try again.",
      });
    }
  };

  const getAchievementIcon = () => {
    switch (type.toLowerCase()) {
      case 'mastery':
        return <Trophy className="h-12 w-12 text-yellow-500" />;
      case 'skill':
        return <Star className="h-12 w-12 text-blue-500" />;
      default:
        return <Award className="h-12 w-12 text-purple-500" />;
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
          <DialogTitle>Share Your Achievement!</DialogTitle>
          <DialogDescription>
            Show off your language learning progress with friends!
          </DialogDescription>
        </DialogHeader>
        <AnimatePresence>
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardHeader>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  className="flex justify-center mb-4"
                >
                  {getAchievementIcon()}
                </motion.div>
                <CardTitle className="text-lg text-center">{title}</CardTitle>
                <CardDescription className="text-center">{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center gap-4 p-4 bg-primary/5 rounded-lg"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.4 }}
                  >
                    <Badge variant="secondary" className="text-lg px-4 py-2">
                      +{points} Points
                    </Badge>
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-sm text-muted-foreground"
                  >
                    {type} Achievement
                  </motion.p>
                </motion.div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="gap-2 hover:bg-[#1DA1F2]/10"
                onClick={() => handleShare("twitter")}
              >
                <Twitter className="h-4 w-4 text-[#1DA1F2]" />
                Share on Twitter
              </Button>
              <Button
                variant="outline"
                className="gap-2 hover:bg-[#4267B2]/10"
                onClick={() => handleShare("facebook")}
              >
                <Facebook className="h-4 w-4 text-[#4267B2]" />
                Share on Facebook
              </Button>
              <Button
                variant="outline"
                className="gap-2 hover:bg-[#0A66C2]/10"
                onClick={() => handleShare("linkedin")}
              >
                <Linkedin className="h-4 w-4 text-[#0A66C2]" />
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
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
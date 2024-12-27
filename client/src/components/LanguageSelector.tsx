import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FaFlagUsa,
  FaFlag,
  FaRegFlag,
} from "react-icons/fa";
import { supportedLanguages } from "@db/schema";

const languageIcons: Record<string, React.ReactNode> = {
  english: <FaFlagUsa className="h-4 w-4 text-blue-600" />,
  spanish: <FaFlag className="h-4 w-4 text-yellow-500" />,
  french: <FaFlag className="h-4 w-4 text-blue-700" />,
  german: <FaFlag className="h-4 w-4 text-yellow-400" />,
  italian: <FaFlag className="h-4 w-4 text-green-600" />,
  portuguese: <FaFlag className="h-4 w-4 text-green-700" />,
  chinese: <FaFlag className="h-4 w-4 text-red-600" />,
  japanese: <FaRegFlag className="h-4 w-4 text-red-500" />,
};

const languageNames: Record<string, string> = {
  english: "English",
  spanish: "Español",
  french: "Français",
  german: "Deutsch",
  italian: "Italiano",
  portuguese: "Português",
  chinese: "中文",
  japanese: "日本語",
};

export function LanguageSelector() {
  const { user, updateUserLanguage } = useUser();
  const { toast } = useToast();

  const handleLanguageChange = async (language: string) => {
    try {
      await updateUserLanguage(language);
      toast({
        title: "Language updated",
        description: `Your learning language has been changed to ${languageNames[language]}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update language. Please try again.",
      });
    }
  };

  if (!user) return null;

  return (
    <Select
      value={user.targetLanguage}
      onValueChange={handleLanguageChange}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select language">
          {user.targetLanguage && (
            <div className="flex items-center gap-2">
              {languageIcons[user.targetLanguage]}
              <span>{languageNames[user.targetLanguage]}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {supportedLanguages.map((lang) => (
          <SelectItem key={lang} value={lang}>
            <div className="flex items-center gap-2">
              {languageIcons[lang]}
              <span>{languageNames[lang]}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
import { useUser } from "@/hooks/use-user";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FaFlagUsa,
  FaGlobeAmericas,
  FaSun,
  FaYinYang,
} from "react-icons/fa";
import { supportedLanguages } from "@db/schema";

const languageIcons: Record<string, React.ReactNode> = {
  english: <FaFlagUsa className="h-4 w-4" />,
  spanish: <FaGlobeAmericas className="h-4 w-4" />,
  french: <FaGlobeAmericas className="h-4 w-4" />,
  german: <FaGlobeAmericas className="h-4 w-4" />,
  italian: <FaGlobeAmericas className="h-4 w-4" />,
  portuguese: <FaGlobeAmericas className="h-4 w-4" />,
  chinese: <FaYinYang className="h-4 w-4" />,
  japanese: <FaSun className="h-4 w-4" />,
  korean: <FaGlobeAmericas className="h-4 w-4" />,
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
  korean: "한국어",
};

export function LanguageSelector() {
  const { user, updateUserLanguage } = useUser();

  const handleLanguageChange = async (language: string) => {
    try {
      await updateUserLanguage(language);
    } catch (error) {
      console.error("Failed to update language:", error);
    }
  };

  return (
    <Select
      value={user?.targetLanguage}
      onValueChange={handleLanguageChange}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select language">
          <div className="flex items-center gap-2">
            {user?.targetLanguage && (
              <>
                {languageIcons[user.targetLanguage]}
                <span>{languageNames[user.targetLanguage]}</span>
              </>
            )}
          </div>
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
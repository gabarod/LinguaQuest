import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { Home, LogOut, User, Users, MessageCircle, Award, Book, Layout } from "lucide-react";
import { LanguageSelector } from "./LanguageSelector";
import { AvatarUpload } from "./AvatarUpload";

export function Navigation() {
  const { user, logout } = useUser();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setLocation("/")}>
            <Home className="h-5 w-5" />
          </Button>

          {user && (
            <>
              <Button variant="ghost" onClick={() => setLocation("/lessons")}>
                <Book className="h-5 w-5 mr-2" />
                <span>Lessons</span>
              </Button>

              <Button variant="ghost" onClick={() => setLocation("/chat")}>
                <MessageCircle className="h-5 w-5 mr-2" />
                <span>Practice Chat</span>
              </Button>

              <Button variant="ghost" onClick={() => setLocation("/buddies")}>
                <Users className="h-5 w-5 mr-2" />
                <span>Find Buddies</span>
              </Button>

              <Button variant="ghost" onClick={() => setLocation("/leaderboard")}>
                <Award className="h-5 w-5 mr-2" />
                <span>Leaderboard</span>
              </Button>
            </>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <div className="flex items-center">
              <AvatarUpload />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="ml-2">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{user.username}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLocation("/practice-sessions")}
                    className="flex items-center gap-2"
                  >
                    <Layout className="h-4 w-4" />
                    <span>My Practice Sessions</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2 text-red-600"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
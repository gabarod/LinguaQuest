import { useQuery } from "@tanstack/react-query";
import { 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface SkillLevel {
  name: string;
  value: number;
  fullMark: number;
}

export function LanguageProficiencyChart() {
  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/user/preferences"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center items-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const skillLevels: SkillLevel[] = [
    { name: "Vocabulary", value: preferences?.skillLevels?.vocabulary ?? 0, fullMark: 5 },
    { name: "Grammar", value: preferences?.skillLevels?.grammar ?? 0, fullMark: 5 },
    { name: "Pronunciation", value: preferences?.skillLevels?.pronunciation ?? 0, fullMark: 5 },
    { name: "Listening", value: preferences?.skillLevels?.listening ?? 0, fullMark: 5 },
    { name: "Speaking", value: preferences?.skillLevels?.speaking ?? 0, fullMark: 5 },
    { name: "Writing", value: preferences?.skillLevels?.writing ?? 0, fullMark: 5 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Language Proficiency</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={skillLevels}>
              <PolarGrid stroke="hsl(var(--muted))" />
              <PolarAngleAxis
                dataKey="name"
                tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 5]}
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Radar
                name="Current Level"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, MessageCircle, Book, Globe, User } from "lucide-react";

const welcomeSteps = [
  {
    title: "¡Bienvenido a LinguaQuest!",
    description: "Tu viaje hacia el dominio de nuevos idiomas comienza aquí.",
    icon: Globe,
  },
  {
    title: "Aprendizaje Personalizado",
    description: "Lecciones adaptadas a tu nivel y objetivos de aprendizaje.",
    icon: Book,
  },
  {
    title: "Práctica Conversacional",
    description: "Mejora tus habilidades con intercambios de idiomas en tiempo real.",
    icon: MessageCircle,
  },
  {
    title: "Únete a la Comunidad",
    description: "Conecta con estudiantes de idiomas de todo el mundo.",
    icon: User,
  },
];

export default function WelcomePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [, setLocation] = useLocation();
  const isLastStep = currentStep === welcomeSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      setLocation("/auth");
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const CurrentIcon = welcomeSteps[currentStep].icon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-primary/10">
                <CurrentIcon className="h-12 w-12 text-primary" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold">{welcomeSteps[currentStep].title}</h1>
              <p className="text-muted-foreground">
                {welcomeSteps[currentStep].description}
              </p>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex gap-1">
                {welcomeSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      index === currentStep
                        ? "w-8 bg-primary"
                        : "w-4 bg-primary/30"
                    }`}
                  />
                ))}
              </div>
              <Button onClick={handleNext} className="gap-2">
                {isLastStep ? "Comenzar" : "Siguiente"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

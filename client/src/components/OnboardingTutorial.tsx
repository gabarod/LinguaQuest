import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";

const slides = [
  {
    title: "Welcome to LinguaQuest!",
    description: "Start your language learning journey with our interactive platform.",
    icon: "🌍",
  },
  {
    title: "Learn Through Practice",
    description: "Master speaking, reading, writing, and listening with AI-powered exercises.",
    icon: "🎯",
  },
  {
    title: "Track Your Progress",
    description: "Watch your skills grow with personalized learning paths and achievements.",
    icon: "📈",
  },
  {
    title: "Connect with Others",
    description: "Practice with learners worldwide and make friends along the way.",
    icon: "🤝",
  },
];

export function OnboardingTutorial() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [, setLocation] = useLocation();

  const nextSlide = () => {
    if (currentSlide === slides.length - 1) {
      setLocation("/");
    } else {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Progress value={(currentSlide / (slides.length - 1)) * 100} className="mb-8" />
        
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-6xl mb-6"
            >
              {slides[currentSlide].icon}
            </motion.div>
            
            <motion.h2
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="text-2xl font-bold mb-4"
            >
              {slides[currentSlide].title}
            </motion.h2>
            
            <motion.p
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="text-muted-foreground mb-8"
            >
              {slides[currentSlide].description}
            </motion.p>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between items-center mt-8">
          <Button
            variant="ghost"
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="w-12 h-12 rounded-full p-0"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <div className="flex gap-2">
            {slides.map((_, index) => (
              <motion.div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentSlide ? "bg-primary" : "bg-muted"
                }`}
                animate={{
                  scale: index === currentSlide ? 1.2 : 1,
                }}
              />
            ))}
          </div>

          <Button
            onClick={nextSlide}
            className="w-12 h-12 rounded-full p-0"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        <Button
          variant="ghost"
          className="w-full mt-4"
          onClick={() => setLocation("/")}
        >
          Skip Tutorial
        </Button>
      </div>
    </div>
  );
}

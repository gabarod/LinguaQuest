export interface Lesson {
  id: number;
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  type: 'speaking' | 'reading' | 'writing' | 'listening';
  points: number;
  duration: number; // in minutes
  completed: boolean;
}

export interface UserProgress {
  userId: number;
  lessonsCompleted: number;
  totalPoints: number;
  streak: number;
  lastActivity: Date;
}

export interface Exercise {
  id: number;
  lessonId: number;
  type: string;
  question: string;
  options?: string[];
  correctAnswer: string;
}

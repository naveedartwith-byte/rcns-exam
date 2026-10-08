export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  examId: string;
  question: string;
  options: string[] | QuestionOption[];
  correctAnswer: string | number; // option ID, text, or index
  marks: number;
  order: number;
}

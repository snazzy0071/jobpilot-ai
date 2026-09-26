import type { QuestionDifficulty, QuestionType } from "@/lib/test-prep/types";
import type { Exhibit, FigureCell } from "@/lib/test-prep/exhibit";

// Admin-facing shapes — kept separate from src/lib/test-prep/types.ts
// on purpose: that file's own header comment explains why the public
// `Question` type can never carry `correctAnswer`/`explanation` (the
// column-level grant means a practice-taker's query literally can't
// return them), and an admin type that included them living in the
// same file would blur that boundary. Every read/write here goes
// through the service-role client (src/lib/test-prep/admin/queries.ts
// and actions.ts), the one thing migration 0067's column grant doesn't
// restrict — never the regular request-scoped client, even though
// requireAdmin() already gates every caller.

export type AdminTestType = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminQuestionPack = {
  id: string;
  testTypeId: string;
  slug: string;
  name: string;
  description: string | null;
  sectorStyle: string | null;
  timeLimitSeconds: number | null;
  createdBy: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminQuestion = {
  id: string;
  questionPackId: string;
  questionType: QuestionType;
  stimulus: string | null;
  prompt: string;
  options: string[];
  exhibit: Exhibit | null;
  optionFigures: FigureCell[] | null;
  correctAnswer: string | null;
  explanation: string | null;
  difficulty: QuestionDifficulty | null;
  subtype: string | null;
  displayOrder: number;
  createdBy: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

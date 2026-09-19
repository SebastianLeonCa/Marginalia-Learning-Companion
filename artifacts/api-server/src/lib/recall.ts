import { randomUUID } from "node:crypto";
import { PDFParse } from "pdf-parse";

const MIN_SOURCE_CHARACTERS = 700;
const MIN_SOURCE_WORDS = 100;
const MAX_SOURCE_CHARACTERS = 60_000;
export const MAX_RECALL_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 80;
const QUIZ_TTL_MS = 30 * 60 * 1000;
const MAX_STORED_QUIZZES = 1_000;

export class InsufficientPdfTextError extends Error {
  constructor() {
    super(
      "This PDF does not contain enough selectable text to create a Recall quiz. Try a text-based PDF instead of a scanned document.",
    );
    this.name = "InsufficientPdfTextError";
  }
}

export class InvalidGeneratedQuizError extends Error {
  constructor(message = "The generated quiz did not meet the Recall format") {
    super(message);
    this.name = "InvalidGeneratedQuizError";
  }
}

export class RecallPdfTooLargeError extends Error {
  constructor() {
    super("This PDF is too large for Recall. Choose a PDF smaller than 25 MB.");
    this.name = "RecallPdfTooLargeError";
  }
}

export type GeneratedRecallQuestion = {
  prompt: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  explanation: string;
  sourceQuote: string;
};

type StoredOption = {
  id: string;
  text: string;
};

type StoredQuestion = {
  id: string;
  prompt: string;
  options: [StoredOption, StoredOption, StoredOption, StoredOption];
  correctOptionId: string;
  explanation: string;
  answer?: {
    selectedOptionId: string;
    correct: boolean;
  };
};

type StoredQuiz = {
  id: string;
  ownerId: string;
  documentId: string;
  documentName: string;
  expiresAt: number;
  questions: StoredQuestion[];
};

export type PublicRecallQuiz = {
  id: string;
  documentId: string;
  documentName: string;
  questions: Array<{
    id: string;
    prompt: string;
    options: StoredOption[];
  }>;
};

export type RecallAnswer =
  | {
      status: "ok";
      value: {
        questionId: string;
        selectedOptionId: string;
        correctOptionId: string;
        correct: boolean;
        explanation: string;
      };
    }
  | { status: "not-found" }
  | { status: "invalid-option" }
  | { status: "already-answered" };

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function validateGeneratedRecallQuiz(
  value: unknown,
  sourceText: string,
): GeneratedRecallQuestion[] {
  const root = asRecord(value);
  if (!root || !Array.isArray(root.questions) || root.questions.length !== 5) {
    throw new InvalidGeneratedQuizError("Recall requires exactly five questions");
  }

  const prompts = new Set<string>();
  const normalizedSource = normalizedText(sourceText).toLocaleLowerCase();
  return root.questions.map((rawQuestion, questionIndex) => {
    const question = asRecord(rawQuestion);
    const prompt = normalizedText(question?.prompt);
    const explanation = normalizedText(question?.explanation);
    const sourceQuote = normalizedText(question?.sourceQuote);
    const options = question?.options;
    const correctOptionIndex = question?.correctOptionIndex;

    if (
      !prompt ||
      !explanation ||
      !sourceQuote ||
      !Array.isArray(options) ||
      options.length !== 4 ||
      !Number.isInteger(correctOptionIndex) ||
      (correctOptionIndex as number) < 0 ||
      (correctOptionIndex as number) > 3
    ) {
      throw new InvalidGeneratedQuizError(
        `Question ${questionIndex + 1} does not have four options and one answer`,
      );
    }

    if (
      sourceQuote.split(/\s+/).length < 5 ||
      !normalizedSource.includes(sourceQuote.toLocaleLowerCase())
    ) {
      throw new InvalidGeneratedQuizError(
        `Question ${questionIndex + 1} is not supported by an exact source quote`,
      );
    }

    const cleanOptions = options.map(normalizedText);
    if (
      cleanOptions.some((option) => !option) ||
      new Set(cleanOptions.map((option) => option.toLocaleLowerCase())).size !== 4
    ) {
      throw new InvalidGeneratedQuizError(
        `Question ${questionIndex + 1} has empty or duplicate options`,
      );
    }

    const promptKey = prompt.toLocaleLowerCase();
    if (prompts.has(promptKey)) {
      throw new InvalidGeneratedQuizError("Recall questions must be distinct");
    }
    prompts.add(promptKey);

    return {
      prompt,
      options: cleanOptions as [string, string, string, string],
      correctOptionIndex: correctOptionIndex as number,
      explanation,
      sourceQuote,
    };
  });
}

export function prepareRecallSource(text: string): string {
  const cleanText = normalizedText(text);
  const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
  if (
    cleanText.length < MIN_SOURCE_CHARACTERS ||
    wordCount < MIN_SOURCE_WORDS
  ) {
    throw new InsufficientPdfTextError();
  }
  return cleanText.slice(0, MAX_SOURCE_CHARACTERS);
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  if (buffer.byteLength > MAX_RECALL_PDF_BYTES) {
    throw new RecallPdfTooLargeError();
  }
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText({ first: MAX_PDF_PAGES });
    return prepareRecallSource(result.text);
  } finally {
    await parser.destroy();
  }
}

function uniqueExcerpts(sourceText: string): string[] {
  const excerpts: string[] = [];
  const seen = new Set<string>();
  const addExcerpt = (value: string) => {
    const excerpt = normalizedText(value).replace(/[.!?]+$/, "");
    const wordCount = excerpt ? excerpt.split(/\s+/).length : 0;
    if (wordCount < 8 || wordCount > 28 || seen.has(excerpt.toLocaleLowerCase())) {
      return;
    }
    seen.add(excerpt.toLocaleLowerCase());
    excerpts.push(excerpt);
  };

  for (const sentence of sourceText.split(/(?<=[.!?])\s+/)) {
    addExcerpt(sentence);
  }

  const words = sourceText.split(/\s+/);
  for (let start = 0; start + 10 <= words.length; start += 10) {
    addExcerpt(words.slice(start, start + 16).join(" "));
  }

  return excerpts;
}

export function generateLocalRecallQuestions(
  sourceText: string,
): GeneratedRecallQuestion[] {
  const excerpts = uniqueExcerpts(sourceText);
  if (excerpts.length < 8) {
    throw new InvalidGeneratedQuizError(
      "The PDF does not contain enough distinct passages for Recall",
    );
  }

  const selected = Array.from({ length: 5 }, (_, index) => {
    const position = Math.floor((index * (excerpts.length - 1)) / 4);
    return excerpts[position];
  });

  const questions = selected.map((sourceQuote, questionIndex) => {
    const distractors = excerpts
      .filter((excerpt) => excerpt !== sourceQuote)
      .slice(questionIndex + 1, questionIndex + 4);
    if (distractors.length < 3) {
      throw new InvalidGeneratedQuizError(
        "The PDF does not contain enough distinct answer choices for Recall",
      );
    }

    const correctOptionIndex = questionIndex % 4;
    const options = [...distractors];
    options.splice(correctOptionIndex, 0, sourceQuote);

    return {
      prompt: `Recall question ${questionIndex + 1}: which statement matches the PDF passage beginning “${sourceQuote
        .split(/\s+/)
        .slice(0, 8)
        .join(" ")}”?`,
      options: options as [string, string, string, string],
      correctOptionIndex,
      explanation:
        "The correct answer is the exact passage from the text extracted from this PDF.",
      sourceQuote,
    };
  });

  return validateGeneratedRecallQuiz({ questions }, sourceText);
}

export async function generateRecallQuestions(
  sourceText: string,
): Promise<GeneratedRecallQuestion[]> {
  return generateLocalRecallQuestions(sourceText);
}

export class RecallQuizStore {
  private readonly quizzes = new Map<string, StoredQuiz>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  create(input: {
    ownerId: string;
    documentId: string;
    documentName: string;
    questions: GeneratedRecallQuestion[];
  }): PublicRecallQuiz {
    this.prune();
    const id = randomUUID();
    const questions = input.questions.map<StoredQuestion>((question) => {
      const options = question.options.map((text) => ({
        id: randomUUID(),
        text,
      })) as [StoredOption, StoredOption, StoredOption, StoredOption];
      return {
        id: randomUUID(),
        prompt: question.prompt,
        options,
        correctOptionId: options[question.correctOptionIndex].id,
        explanation: question.explanation,
      };
    });
    const quiz: StoredQuiz = {
      id,
      ownerId: input.ownerId,
      documentId: input.documentId,
      documentName: input.documentName,
      expiresAt: this.now() + QUIZ_TTL_MS,
      questions,
    };
    this.quizzes.set(id, quiz);
    this.prune();
    return this.toPublicQuiz(quiz);
  }

  answer(input: {
    ownerId: string;
    quizId: string;
    questionId: string;
    optionId: string;
  }): RecallAnswer {
    this.prune();
    const quiz = this.quizzes.get(input.quizId);
    if (!quiz || quiz.ownerId !== input.ownerId) {
      return { status: "not-found" };
    }
    const question = quiz.questions.find((item) => item.id === input.questionId);
    if (!question) {
      return { status: "not-found" };
    }
    if (!question.options.some((option) => option.id === input.optionId)) {
      return { status: "invalid-option" };
    }
    if (question.answer && question.answer.selectedOptionId !== input.optionId) {
      return { status: "already-answered" };
    }

    const correct = input.optionId === question.correctOptionId;
    question.answer ??= { selectedOptionId: input.optionId, correct };
    return {
      status: "ok",
      value: {
        questionId: question.id,
        selectedOptionId: question.answer.selectedOptionId,
        correctOptionId: question.correctOptionId,
        correct: question.answer.correct,
        explanation: question.explanation,
      },
    };
  }

  private toPublicQuiz(quiz: StoredQuiz): PublicRecallQuiz {
    return {
      id: quiz.id,
      documentId: quiz.documentId,
      documentName: quiz.documentName,
      questions: quiz.questions.map(({ id, prompt, options }) => ({
        id,
        prompt,
        options,
      })),
    };
  }

  private prune() {
    const now = this.now();
    for (const [id, quiz] of this.quizzes) {
      if (quiz.expiresAt <= now) {
        this.quizzes.delete(id);
      }
    }
    while (this.quizzes.size >= MAX_STORED_QUIZZES) {
      const oldestId = this.quizzes.keys().next().value as string | undefined;
      if (!oldestId) break;
      this.quizzes.delete(oldestId);
    }
  }
}
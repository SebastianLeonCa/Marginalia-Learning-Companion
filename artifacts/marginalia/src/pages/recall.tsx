import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  FileText,
  LoaderCircle,
  RotateCcw,
  X,
} from "lucide-react";
import {
  useAnswerRecallQuestion,
  useCreateRecallQuiz,
  type RecallAnswerResult,
  type RecallQuiz,
} from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { AppShell } from "@/components/marginalia-ui";

function apiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "error" in data) {
      const message = (data as { error?: unknown }).error;
      if (typeof message === "string") return message;
    }
  }
  return fallback;
}

export default function RecallPage() {
  const { studySetId = "", documentId = "" } = useParams<{
    studySetId: string;
    documentId: string;
  }>();
  const startedFor = useRef("");
  const creditedQuestions = useRef(new Set<string>());
  const [quiz, setQuiz] = useState<RecallQuiz | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [feedback, setFeedback] = useState<RecallAnswerResult | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);

  const createQuiz = useCreateRecallQuiz({
    mutation: {
      onSuccess: (nextQuiz) => {
        setQuiz(nextQuiz);
        setQuestionIndex(0);
        setSelectedOptionId("");
        setFeedback(null);
        setScore(0);
        creditedQuestions.current.clear();
        setFinished(false);
      },
    },
  });
  const answerQuestion = useAnswerRecallQuestion({
    mutation: {
      onSuccess: (result) => {
        setFeedback(result);
        if (result.correct && !creditedQuestions.current.has(result.questionId)) {
          creditedQuestions.current.add(result.questionId);
          setScore((current) => current + 1);
        }
      },
    },
  });

  useEffect(() => {
    const key = `${studySetId}:${documentId}`;
    if (!studySetId || !documentId || startedFor.current === key) return;
    startedFor.current = key;
    createQuiz.mutate({ studySetId, documentId });
  }, [studySetId, documentId]);

  function restart() {
    setShowRegeneratePrompt(false);
    setQuiz(null);
    setFeedback(null);
    setSelectedOptionId("");
    createQuiz.mutate({ studySetId, documentId });
  }

  if (!quiz && createQuiz.isPending) {
    return (
      <AppShell>
        <main className="grid min-h-[calc(100dvh-73px)] place-items-center px-5 py-16 md:min-h-[100dvh]">
          <div className="max-w-md text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground"><LoaderCircle className="animate-spin" size={28} /></span>
            <p className="mt-7 text-[11px] font-bold uppercase tracking-[.2em] text-primary">Recall is reading</p>
            <h1 className="mt-3 font-serif text-4xl font-bold">Building five questions</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">The quiz is being grounded in this PDF only. Its answer key stays private on the server.</p>
          </div>
        </main>
      </AppShell>
    );
  }

  if (!quiz) {
    return (
      <AppShell>
        <main className="mx-auto max-w-xl px-5 py-20 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><AlertCircle size={28} /></span>
          <p className="mt-7 text-[11px] font-bold uppercase tracking-[.2em] text-primary">Recall could not begin</p>
          <h1 className="mt-3 font-serif text-4xl font-bold">This PDF needs another look.</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {apiErrorMessage(createQuiz.error, "We could not create a reliable quiz from this document. Please try again.")}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={restart} disabled={createQuiz.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="button-retry-recall"><RotateCcw size={16} /> Try again</button>
            <Link href={`/study-sets/${studySetId}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-bold"><ArrowLeft size={16} /> Choose another PDF</Link>
          </div>
        </main>
      </AppShell>
    );
  }

  if (finished) {
    const percentage = Math.round((score / quiz.questions.length) * 100);
    return (
      <AppShell>
        <main className="mx-auto max-w-2xl px-5 py-10 md:px-10 md:py-16">
          <Link href={`/study-sets/${studySetId}`} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary"><ArrowLeft size={16} /> Back to study set</Link>
          <section className="mt-8 overflow-hidden rounded-3xl border-2 border-blue bg-card shadow-[7px_7px_0_#252944]">
            <div className="bg-blue px-7 py-10 text-center text-background md:px-12">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent text-foreground"><CheckCircle2 size={30} /></span>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[.2em] text-accent">Recall complete</p>
              <h1 className="mt-3 font-serif text-5xl font-bold">{score} / {quiz.questions.length}</h1>
              <p className="mt-2 text-sm font-semibold text-background/75">{percentage}% correct</p>
            </div>
            <div className="p-7 text-center md:p-10">
              <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-bold"><FileText size={15} className="text-primary" /><span className="truncate">{quiz.documentName}</span></p>
              <h2 className="mt-6 font-serif text-3xl font-bold">{score === 5 ? "Every answer found its place." : "A useful pass through the material."}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">You can generate a fresh set of five questions from the same PDF, or return to the study set.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <button type="button" onClick={restart} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="button-repeat-recall"><RotateCcw size={16} /> New quiz</button>
                <Link href={`/study-sets/${studySetId}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-bold"><ArrowLeft size={16} /> Back to study set</Link>
              </div>
            </div>
          </section>
        </main>
      </AppShell>
    );
  }

  const activeQuiz = quiz;
  const question = activeQuiz.questions[questionIndex];
  const progress = ((questionIndex + 1) / activeQuiz.questions.length) * 100;

  function submitAnswer() {
    if (!selectedOptionId || feedback) return;
    answerQuestion.mutate({
      quizId: activeQuiz.id,
      questionId: question.id,
      data: { optionId: selectedOptionId },
    });
  }

  function continueQuiz() {
    if (questionIndex === activeQuiz.questions.length - 1) {
      setFinished(true);
      return;
    }
    setQuestionIndex((current) => current + 1);
    setSelectedOptionId("");
    setFeedback(null);
    answerQuestion.reset();
  }

  return (
    <AppShell>
      <main className="min-h-[calc(100dvh-73px)] bg-[#efe6d4] px-5 py-7 md:min-h-[100dvh] md:px-10 md:py-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href={`/study-sets/${studySetId}`} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary"><ArrowLeft size={16} /> Leave quiz</Link>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="inline-flex max-w-[70vw] items-center gap-2 rounded-full bg-card px-4 py-2 text-xs font-bold text-muted-foreground"><FileText size={14} /><span className="truncate">{quiz.documentName}</span></span>
              {!showRegeneratePrompt ? (
                <button
                  type="button"
                  onClick={() => setShowRegeneratePrompt(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary"
                  data-testid="button-regenerate-recall"
                >
                  <RotateCcw size={14} /> New quiz
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-bold text-foreground" role="group" aria-label="Confirm new quiz">
                  <span>Replace this quiz?</span>
                  <button type="button" onClick={() => setShowRegeneratePrompt(false)} className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-card" data-testid="button-cancel-regenerate-recall">Cancel</button>
                  <button type="button" onClick={restart} disabled={createQuiz.isPending} className="rounded-lg bg-primary px-2 py-1 text-primary-foreground disabled:opacity-50" data-testid="button-confirm-regenerate-recall">Generate</button>
                </div>
              )}
            </div>
          </div>

          <section className="mt-7 rounded-3xl border-2 border-blue bg-card p-6 shadow-[7px_7px_0_#252944] md:p-10">
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-primary"><Brain size={15} /> Question {questionIndex + 1} of {quiz.questions.length}</span>
              <span className="text-xs font-bold text-muted-foreground">{score} correct</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></div>
            <h1 className="mt-8 font-serif text-3xl font-bold leading-tight md:text-4xl">{question.prompt}</h1>

            <div className="mt-8 space-y-3" role="radiogroup" aria-label="Answer options">
              {question.options.map((option, index) => {
                const selected = selectedOptionId === option.id;
                const isCorrect = feedback?.correctOptionId === option.id;
                const isWrongSelection = Boolean(feedback && selected && !feedback.correct);
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={Boolean(feedback) || answerQuestion.isPending}
                    onClick={() => setSelectedOptionId(option.id)}
                    className={`flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isCorrect ? "border-[#4b815d] bg-[#e4f0e5]" : isWrongSelection ? "border-primary bg-primary/10" : selected ? "border-blue bg-blue/5" : "border-border bg-background hover:border-blue/50"
                    }`}
                    data-testid={`button-recall-option-${index}`}
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${isCorrect ? "bg-[#4b815d] text-white" : isWrongSelection ? "bg-primary text-primary-foreground" : selected ? "bg-blue text-background" : "bg-muted text-muted-foreground"}`}>
                      {isCorrect ? <Check size={16} /> : isWrongSelection ? <X size={16} /> : String.fromCharCode(65 + index)}
                    </span>
                    <span className="pt-1 text-sm font-semibold leading-relaxed">{option.text}</span>
                  </button>
                );
              })}
            </div>

            {answerQuestion.isError && !feedback ? (
              <div className="mt-5 rounded-2xl bg-primary/10 p-4 text-sm text-primary">
                <p>{apiErrorMessage(answerQuestion.error, "We could not check that answer. Please try again.")}</p>
                <button type="button" onClick={restart} className="mt-3 inline-flex items-center gap-2 font-bold underline underline-offset-4"><RotateCcw size={14} /> Start a new quiz</button>
              </div>
            ) : null}

            {feedback ? (
              <div className={`mt-6 rounded-2xl border p-5 ${feedback.correct ? "border-[#7fad8a] bg-[#e4f0e5]" : "border-primary/30 bg-primary/10"}`} aria-live="polite">
                <p className="flex items-center gap-2 font-serif text-xl font-bold">{feedback.correct ? <CheckCircle2 className="text-[#4b815d]" size={21} /> : <AlertCircle className="text-primary" size={21} />}{feedback.correct ? "Correct" : "Not quite"}</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/80">{feedback.explanation}</p>
              </div>
            ) : null}

            <div className="mt-7 flex justify-end">
              {feedback ? (
                <button type="button" onClick={continueQuiz} className="inline-flex items-center gap-2 rounded-xl bg-blue px-5 py-3 text-sm font-bold text-background" data-testid="button-next-recall">{questionIndex === quiz.questions.length - 1 ? "See results" : "Next question"} <ArrowRight size={16} /></button>
              ) : (
                <button type="button" onClick={submitAnswer} disabled={!selectedOptionId || answerQuestion.isPending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-submit-recall">{answerQuestion.isPending ? <LoaderCircle className="animate-spin" size={16} /> : null} Check answer</button>
              )}
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
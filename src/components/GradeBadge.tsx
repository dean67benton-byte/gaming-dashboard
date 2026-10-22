import { GRADE_STYLE, type Letter } from "@/lib/grades";

const SIZE = { sm: "h-6 w-6 text-xs rounded-md", md: "h-9 w-9 text-base rounded-lg", lg: "h-14 w-14 text-2xl rounded-xl" };

export default function GradeBadge({ letter, score, size = "md" }: { letter: Letter | null; score?: number; size?: keyof typeof SIZE }) {
  return (
    <span
      title={score !== undefined ? `Score ${score} (100 = your normal)` : "Not enough games to grade"}
      className={`inline-flex shrink-0 items-center justify-center font-black ${SIZE[size]} ${letter ? GRADE_STYLE[letter] : "bg-surface-2 text-muted"}`}
    >
      {letter ?? "–"}
    </span>
  );
}

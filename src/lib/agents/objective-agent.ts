export function objectiveFromUserInput(userObjective: string): {
  title: string;
  description: string;
  output_intent: string;
} {
  const text = userObjective.trim();
  const title =
    text.split(/[.!?\n]/)[0]?.trim().slice(0, 120) || "Learning objective";

  return {
    title,
    description: text,
    output_intent: `Upload your book and highlight passages that help you ${title.charAt(0).toLowerCase()}${title.slice(1)}.`,
  };
}

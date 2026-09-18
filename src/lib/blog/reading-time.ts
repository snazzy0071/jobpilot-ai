import type { ContentBlock } from "@/lib/blog/types";

const WORDS_PER_MINUTE = 200;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function getWordCount(content: ContentBlock[]): number {
  return content.reduce((total, block) => {
    if (block.type === "list") {
      return total + block.items.reduce((sum, item) => sum + countWords(item), 0);
    }
    return total + countWords(block.text);
  }, 0);
}

export function getReadingTimeMinutes(content: ContentBlock[]): number {
  return Math.max(1, Math.round(getWordCount(content) / WORDS_PER_MINUTE));
}

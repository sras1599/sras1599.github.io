const WORDS_PER_MINUTE = 200;

export function getReadingTime(markdown: string) {
  const readableText = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_~|-]+/g, " ");

  const words = readableText.match(
    /[\p{L}\p{N}]+(?:['’.][\p{L}\p{N}]+)*/gu,
  )?.length ?? 0;
  const minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));

  return `${minutes} min read`;
}

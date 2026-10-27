const arabicScript = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

export function containsArabic(text: string) {
  return arabicScript.test(text);
}

export function cleanPostBody(title: string, body: string) {
  const lines = body.trim().split(/\r?\n/);
  const firstLine = (lines[0] ?? '').trim();
  const repeatedTitle = firstLine.replace(/^(?:title|عنوان)\s*[:：]\s*/i, '').trim();

  if (repeatedTitle.toLocaleLowerCase() === title.trim().toLocaleLowerCase()) {
    lines.shift();
    while (lines[0]?.trim() === '') lines.shift();
  }

  return lines.join('\n').trim();
}

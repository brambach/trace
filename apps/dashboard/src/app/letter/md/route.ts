import { letterMarkdown } from '@trace/coach';
import { letterFor } from '@/lib/letter';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const week = new URL(req.url).searchParams.get('week') ?? undefined;
  const letter = letterFor(week);
  return new Response(letterMarkdown(letter), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="trace-letter-${letter.weekStart}.md"`,
    },
  });
}

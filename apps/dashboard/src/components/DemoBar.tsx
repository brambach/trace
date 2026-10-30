import { REPO_URL } from '@/lib/mode';

export function DemoBar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-sunk px-5 py-2 text-[12.5px] text-muted sm:px-8">
      <span>Demo. These sessions are made up, and nothing you click here is saved.</span>
      <a href={REPO_URL} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
        Run it on your own sessions
      </a>
    </div>
  );
}

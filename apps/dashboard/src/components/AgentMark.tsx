// Trace's own marks for each agent, never their logos: an asterisk for
// Claude Code, a chevron for Codex.
export function AgentMark({ agent, className = 'h-3.5 w-3.5' }: { agent: 'claude' | 'codex'; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-label={agent === 'claude' ? 'Claude Code' : 'Codex'}>
      {agent === 'claude' ? (
        <path d="M8 2.5v11M3.2 5.25l9.6 5.5M3.2 10.75l9.6-5.5" />
      ) : (
        <path d="M4.5 4l4 4-4 4M9.5 12h3" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function agentName(agent: 'claude' | 'codex'): string {
  return agent === 'claude' ? 'Claude Code' : 'Codex';
}

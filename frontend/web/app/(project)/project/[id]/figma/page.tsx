'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Figma, Loader2 } from 'lucide-react';
import { buildFigmaEmbedUrl } from '@/lib/figma';
import { fetchProjectDetails, type ProjectSummary } from '@/services/projects-service';

type LoadState = 'loading' | 'ready' | 'error';
type IframeState = 'idle' | 'loading' | 'loaded' | 'blocked';

export default function ProjectFigmaPage() {
  const params = useParams();
  const projectId = typeof params?.id === 'string' ? params.id : '';
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [iframeState, setIframeState] = useState<IframeState>('idle');

  useEffect(() => {
    if (!projectId) {
      setState('error');
      return;
    }

    let cancelled = false;
    setState('loading');

    fetchProjectDetails(projectId)
      .then((data) => {
        if (cancelled) return;
        setProject(data);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const figmaUrl = typeof project?.figmaUrl === 'string' ? project.figmaUrl : null;
  const embedUrl = useMemo(() => buildFigmaEmbedUrl(figmaUrl), [figmaUrl]);
  const showEmbedFallback = state === 'ready' && figmaUrl && (!embedUrl || iframeState === 'blocked');

  useEffect(() => {
    if (!embedUrl) {
      setIframeState('idle');
      return;
    }

    setIframeState('loading');
    const fallbackTimer = window.setTimeout(() => {
      setIframeState((current) => (current === 'loaded' ? current : 'blocked'));
    }, 8000);

    return () => window.clearTimeout(fallbackTimer);
  }, [embedUrl]);

  return (
    <main className="flex min-h-[calc(100vh-120px)] flex-col bg-cu-bg text-cu-text-primary">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cu-border px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={projectId ? `/project/${projectId}/settings` : '/dashboard'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cu-border text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
            aria-label="Back to project settings"
          >
            <ArrowLeft size={17} />
          </Link>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <Figma size={17} className="shrink-0 text-[#F24E1E]" />
              <h1 className="truncate text-base font-bold font-outfit">Figma Integration</h1>
            </div>
            <p className="mt-0.5 truncate text-xs text-cu-text-muted font-outfit">
              {project?.name ?? 'Project design'}
            </p>
          </div>
        </div>

        {figmaUrl && (
          <a
            href={figmaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 max-w-full items-center justify-center gap-2 rounded-lg border border-cu-border px-3 text-sm font-semibold text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary font-outfit"
          >
            <ExternalLink size={15} className="shrink-0" />
            <span className="truncate">Open in Figma</span>
          </a>
        )}
      </header>

      <section className="flex min-h-0 flex-1 flex-col">
        {state === 'loading' && (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm font-semibold text-cu-text-secondary">
            <Loader2 size={18} className="animate-spin" />
            Loading Figma link...
          </div>
        )}

        {state === 'error' && (
          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 text-center">
            <Figma size={32} className="text-cu-text-muted" />
            <h2 className="mt-4 text-lg font-bold text-cu-text-primary font-outfit">Unable to load Figma link</h2>
            <p className="mt-2 text-sm text-cu-text-secondary font-outfit">
              Refresh the page or check the project settings.
            </p>
          </div>
        )}

        {state === 'ready' && !figmaUrl && (
          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 text-center">
            <Figma size={32} className="text-cu-text-muted" />
            <h2 className="mt-4 text-lg font-bold text-cu-text-primary font-outfit">No Figma link saved</h2>
            <p className="mt-2 text-sm text-cu-text-secondary font-outfit">
              Add a Figma URL in project settings to view it here.
            </p>
          </div>
        )}

        {showEmbedFallback && (
          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 text-center">
            <Figma size={32} className="text-[#F24E1E]" />
            <h2 className="mt-4 text-lg font-bold text-cu-text-primary font-outfit">This Figma link cannot be displayed here</h2>
            <p className="mt-2 text-sm text-cu-text-secondary font-outfit">
              The file may be private, blocked by browser policy, or not available for embedding.
            </p>
            <p className="mt-2 break-words text-sm text-cu-text-secondary font-outfit">{figmaUrl}</p>
            <a
              href={figmaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex h-10 max-w-full items-center justify-center gap-2 rounded-lg bg-cu-primary px-4 text-sm font-bold text-white transition-colors hover:bg-cu-primary-hover font-outfit"
            >
              <ExternalLink size={16} className="shrink-0" />
              <span className="truncate">Open in Figma</span>
            </a>
          </div>
        )}

        {state === 'ready' && figmaUrl && embedUrl && iframeState !== 'blocked' && (
          <div className="relative flex min-h-[520px] flex-1">
            {iframeState === 'loading' && (
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-cu-bg text-sm font-semibold text-cu-text-secondary">
                <Loader2 size={18} className="animate-spin" />
                Loading Figma preview...
              </div>
            )}
            <iframe
              title={`${project?.name ?? 'Project'} Figma design`}
              src={embedUrl}
              allowFullScreen
              onLoad={() => setIframeState('loaded')}
              onError={() => setIframeState('blocked')}
              className={`h-[calc(100vh-184px)] min-h-[520px] w-full border-0 ${iframeState === 'loaded' ? 'block' : 'invisible'}`}
            />
          </div>
        )}
      </section>
    </main>
  );
}

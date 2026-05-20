import React, { useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import {
  Maximize,
  Pause,
  Play,
  Settings,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { getYouTubeVideoId, sanitizeVideoUrl } from '../utils/videoLinks';
import { reportClientEvent } from '../services/clientTelemetry';
import { InteractiveQuestion, Question } from '../types';
import { normalizeQuestionHtml } from '../utils/questionHtml';

interface CustomVideoPlayerProps {
  url: string;
  title?: string;
  interactiveQuestions?: InteractiveQuestion[];
  questionBank?: Question[];
}

interface NormalizedVideoSource {
  playerUrl: string;
  externalUrl: string;
  iframeUrl?: string;
  blockedProvider?: string;
  provider?: 'youtube' | 'vimeo' | 'drive' | 'file';
  videoId?: string;
}

interface PlyrYouTubePlayerProps {
  videoId: string;
  title?: string;
  interactiveQuestions?: InteractiveQuestion[];
  questionBank?: Question[];
}

interface VideoQuestionOverlayProps {
  question: InteractiveQuestion;
  bankQuestion?: Question;
  onAnswer: (isCorrect: boolean) => void;
  onSkip: () => void;
}

const VideoQuestionOverlay: React.FC<VideoQuestionOverlayProps> = ({ question, bankQuestion, onAnswer, onSkip }) => {
  const inlineQuestion = question.inlineQuestion || (bankQuestion
    ? {
        text: bankQuestion.text,
        options: bankQuestion.options,
        correctOptionIndex: bankQuestion.correctOptionIndex,
      }
    : undefined);
  if (!inlineQuestion) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-4" dir="rtl">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
        <div className="mb-3 text-xs font-bold text-indigo-600">سؤال سريع داخل الدرس</div>
        {bankQuestion?.imageUrl ? (
          <img
            src={bankQuestion.imageUrl}
            alt="صورة السؤال"
            className="mb-3 max-h-56 w-full rounded-xl border border-gray-100 object-contain"
          />
        ) : null}
        <div
          className="mb-4 text-base font-bold leading-8 text-gray-900 sm:text-lg"
          dangerouslySetInnerHTML={{ __html: normalizeQuestionHtml(inlineQuestion.text) }}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {inlineQuestion.options.map((option, index) => (
            <button
              key={`${question.id}-${index}`}
              onClick={() => onAnswer(index === inlineQuestion.correctOptionIndex)}
              className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-bold text-gray-800 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-800"
              dangerouslySetInnerHTML={{ __html: normalizeQuestionHtml(option) }}
            />
          ))}
        </div>
        {!question.mustPass ? (
          <button onClick={onSkip} className="mt-4 text-xs font-bold text-gray-500 hover:text-gray-800">
            متابعة بدون إجابة الآن
          </button>
        ) : null}
      </div>
    </div>
  );
};

const getDueVideoQuestion = (
  questions: InteractiveQuestion[],
  questionBank: Question[],
  answeredQuestionIds: Set<string>,
  currentTime: number,
) =>
  questions
    .filter((question) => {
      const hasRenderableQuestion = Boolean(question.inlineQuestion || questionBank.some((item) => item.id === question.questionId));
      return hasRenderableQuestion && !answeredQuestionIds.has(question.id) && currentTime >= question.timestamp;
    })
    .sort((first, second) => first.timestamp - second.timestamp)[0] || null;

const PlyrYouTubePlayer: React.FC<PlyrYouTubePlayerProps> = ({ videoId, title, interactiveQuestions = [], questionBank = [] }) => {
  const playerElementRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<Plyr | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<InteractiveQuestion | null>(null);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!playerElementRef.current) return undefined;

    const player = new Plyr(playerElementRef.current, {
      controls: [
        'restart',
        'rewind',
        'play',
        'fast-forward',
        'progress',
        'current-time',
        'duration',
        'mute',
        'volume',
        'settings',
        'fullscreen',
      ],
      settings: ['speed'],
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
      seekTime: 10,
      fullscreen: { enabled: true, fallback: true, iosNative: false },
      youtube: {
        noCookie: true,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        controls: 0,
        disablekb: 1,
        playsinline: 1,
      },
    } as Plyr.Options);

    playerInstanceRef.current = player;
    player.on('timeupdate', () => {
      if (activeQuestion) return;
      const currentTime = Number(player.currentTime || 0);
      const dueQuestion = getDueVideoQuestion(interactiveQuestions, questionBank, answeredQuestionIds, currentTime);
      if (dueQuestion) {
        player.pause();
        setActiveQuestion(dueQuestion);
      }
    });
    player.on('error', (event) => {
      void reportClientEvent({
        source: 'video-player',
        severity: 'warning',
        message: 'YouTube lesson player error',
        metadata: {
          title,
          videoId,
          eventType: event.type,
        },
      });
    });

    return () => {
      playerInstanceRef.current?.destroy();
      playerInstanceRef.current = null;
    };
  }, [videoId, interactiveQuestions, questionBank, answeredQuestionIds, activeQuestion]);

  const resolveQuestion = (isCorrect: boolean) => {
    if (!activeQuestion) return;
    setAnsweredQuestionIds((previous) => new Set(previous).add(activeQuestion.id));
    if (!isCorrect && activeQuestion.actionOnFail === 'rewatch') {
      const player = playerInstanceRef.current;
      if (player) {
        player.currentTime = Math.max(0, activeQuestion.rewatchTimestamp ?? (player.currentTime || 0) - 15);
      }
    }
    setActiveQuestion(null);
    playerInstanceRef.current?.play();
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl bg-black group">
      <div
        ref={playerElementRef}
        data-plyr-provider="youtube"
        data-plyr-embed-id={videoId}
        aria-label={title || 'مشغل فيديو منصة المئة'}
      />
      <div className="absolute left-0 right-0 top-0 z-[15] h-24 cursor-default bg-gradient-to-b from-black via-black/90 to-transparent" />
      <div className="absolute bottom-12 right-0 z-[15] h-16 w-40 cursor-default bg-gradient-to-l from-black via-black/85 to-transparent" />
      {title ? (
        <div className="pointer-events-none absolute left-4 right-4 top-4 z-20 rounded-2xl bg-black/35 px-4 py-2 text-right text-sm font-bold text-white backdrop-blur" dir="rtl">
          {title}
        </div>
      ) : null}
      {activeQuestion ? (
        <VideoQuestionOverlay
          question={activeQuestion}
          bankQuestion={questionBank.find((question) => question.id === activeQuestion.questionId)}
          onAnswer={resolveQuestion}
          onSkip={() => resolveQuestion(true)}
        />
      ) : null}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .plyr,
            .plyr__video-wrapper {
              height: 100%;
              border-radius: 1.5rem;
            }
            .plyr__video-embed iframe {
              pointer-events: none;
            }
            .plyr--full-ui input[type='range'] {
              color: #14b8a6;
            }
            .plyr__control--overlaid,
            .plyr--video .plyr__control:hover,
            .plyr--video .plyr__control[aria-expanded='true'] {
              background: #14b8a6;
            }
          `,
        }}
      />
    </div>
  );
};

const normalizeVideoUrl = (rawUrl: string) => {
  const url = sanitizeVideoUrl(rawUrl);
  if (!url) return { playerUrl: '', externalUrl: '' };

  const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  try {
    const parsedUrl = new URL(safeUrl);
    const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be' || host.includes('youtube.com')) {
      const videoId = getYouTubeVideoId(safeUrl);
      if (videoId) {
        return {
          playerUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
          externalUrl: safeUrl,
          provider: 'youtube',
          videoId,
        };
      }
      return { playerUrl: '', externalUrl: safeUrl, blockedProvider: 'YouTube' };
    }

    if (host.includes('vimeo.com')) {
      const videoId = parsedUrl.pathname.split('/').filter(Boolean).find((part) => /^\d+$/.test(part));
      if (videoId) {
        const normalized = `https://vimeo.com/${videoId}`;
        return {
          playerUrl: `https://player.vimeo.com/video/${videoId}`,
          iframeUrl: `https://player.vimeo.com/video/${videoId}`,
          externalUrl: normalized,
          provider: 'vimeo',
        };
      }
    }

    if (host === 'drive.google.com') {
      const fileId =
        parsedUrl.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ||
        parsedUrl.searchParams.get('id');
      if (fileId) {
        return {
          playerUrl: `https://drive.google.com/file/d/${fileId}/preview`,
          iframeUrl: `https://drive.google.com/file/d/${fileId}/preview`,
          externalUrl: `https://drive.google.com/file/d/${fileId}/view`,
          provider: 'drive',
        };
      }
    }

    if (host.includes('dropbox.com')) {
      parsedUrl.searchParams.set('raw', '1');
      parsedUrl.searchParams.delete('dl');
      return { playerUrl: parsedUrl.toString(), externalUrl: safeUrl };
    }
  } catch {
    return { playerUrl: url, externalUrl: url };
  }

  return { playerUrl: safeUrl, externalUrl: safeUrl, provider: 'file' };
};

export const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({ url, title, interactiveQuestions = [], questionBank = [] }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoSource = normalizeVideoUrl(url);
  const normalizedUrl = videoSource.playerUrl;

  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<InteractiveQuestion | null>(null);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setPlaying(false);
    setPlayed(0);
    setDuration(0);
    setHasPlaybackError(false);
    setActiveQuestion(null);
    setAnsweredQuestionIds(new Set());
  }, [normalizedUrl]);

  useEffect(() => {
    return () => {
      try {
        videoRef.current?.pause();
      } catch {
        // Ignore player cleanup errors when closing modals or switching routes.
      }
      setPlaying(false);
    };
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (playing && !seeking) {
      timeout = setTimeout(() => setShowControls(false), 3000);
    } else {
      setShowControls(true);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [playing, seeking, showControls]);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) {
      setPlaying((value) => !value);
      return;
    }

    if (video.paused) {
      void video.play().catch(() => {
        setPlaying(false);
      });
    } else {
      video.pause();
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted, normalizedUrl]);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextVolume = parseFloat(event.target.value);
    setVolume(nextVolume);
    setMuted(nextVolume === 0);
  };

  const handleProgress = (state: { played: number; playedSeconds?: number }) => {
    if (!seeking) {
      setPlayed(state.played);
    }
    if (!activeQuestion) {
      const dueQuestion = getDueVideoQuestion(interactiveQuestions, questionBank, answeredQuestionIds, state.playedSeconds || 0);
      if (dueQuestion) {
        videoRef.current?.pause();
        setPlaying(false);
        setActiveQuestion(dueQuestion);
      }
    }
  };

  const resolveQuestion = (isCorrect: boolean) => {
    if (!activeQuestion) return;
    setAnsweredQuestionIds((previous) => new Set(previous).add(activeQuestion.id));
    if (!isCorrect && activeQuestion.actionOnFail === 'rewatch') {
      const currentTime = videoRef.current?.currentTime || 0;
      const targetTime = Math.max(0, activeQuestion.rewatchTimestamp ?? currentTime - 15);
      if (videoRef.current) {
        videoRef.current.currentTime = targetTime;
      }
    }
    setActiveQuestion(null);
    void videoRef.current?.play().catch(() => setPlaying(false));
  };

  const handleSeekMouseUp = (event: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    const nextValue = parseFloat((event.target as HTMLInputElement).value);
    setSeeking(false);
    if (videoRef.current && duration > 0) {
      videoRef.current.currentTime = nextValue * duration;
    }
  };

  const handleReady = () => {
    setHasPlaybackError(false);
    const playerDuration = videoRef.current?.duration || 0;
    if (playerDuration > 0) setDuration(playerDuration);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
      return;
    }

    document.exitFullscreen();
    setIsFullscreen(false);
  };

  const formatTime = (seconds: number) => {
    const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
    const date = new Date(safeSeconds * 1000);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const displaySeconds = date.getUTCSeconds().toString().padStart(2, '0');
    if (hours) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${displaySeconds}`;
    }
    return `${minutes}:${displaySeconds}`;
  };

  const seekBySeconds = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
  };

  const usesNativeIframe = Boolean(videoSource.iframeUrl);

  if (videoSource.provider === 'youtube' && videoSource.videoId) {
    return <PlyrYouTubePlayer videoId={videoSource.videoId} title={title} interactiveQuestions={interactiveQuestions} questionBank={questionBank} />;
  }

  if (!normalizedUrl && videoSource.blockedProvider) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-3xl bg-slate-950 px-6 text-center text-white" dir="rtl">
        <p className="text-lg font-bold">هذا المصدر غير متاح داخل مشغل المنصة</p>
        <p className="max-w-md text-sm leading-7 text-white/70">
          استخدم ملف فيديو مباشر أو خدمة استضافة فيديو خاصة حتى يعمل الدرس داخل المشغل الداخلي بدون أي واجهة خارجية.
        </p>
      </div>
    );
  }

  if (!normalizedUrl) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-3xl bg-slate-950 px-6 text-center text-white" dir="rtl">
        <p className="text-lg font-bold">لا يوجد رابط فيديو صالح لهذا الدرس</p>
        <p className="max-w-md text-sm leading-7 text-white/70">
          أضف رابط يوتيوب أو ملف فيديو من الإدارة حتى يظهر الدرس للطلاب داخل المنصة.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group overflow-hidden rounded-3xl"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => playing && setShowControls(false)}
      dir="ltr"
    >
      {usesNativeIframe ? (
        <iframe
          src={videoSource.iframeUrl}
          title={title || 'منصة المئة التعليمية'}
          className="h-full w-full border-0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video
          ref={videoRef}
          src={normalizedUrl}
          className="h-full w-full bg-black object-contain"
          playsInline
          preload="metadata"
          controls={false}
          controlsList="nodownload"
          onLoadedMetadata={handleReady}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            const nextDuration = Number(video.duration || duration || 0);
            if (nextDuration > 0 && nextDuration !== duration) {
              setDuration(nextDuration);
            }
            handleProgress({
              played: nextDuration > 0 ? video.currentTime / nextDuration : 0,
              playedSeconds: video.currentTime,
            });
          }}
          onError={() => {
            setPlaying(false);
            setHasPlaybackError(true);
            void reportClientEvent({
              source: 'video-player',
              severity: 'warning',
              message: 'Lesson video playback failed',
              metadata: {
                title,
                url: normalizedUrl,
                externalUrl: videoSource.externalUrl,
                provider: videoSource.provider || (usesNativeIframe ? 'iframe' : 'file'),
              },
            });
          }}
        />
      )}

      {hasPlaybackError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center text-white" dir="rtl">
          <p className="text-lg font-bold">تعذر تشغيل هذا الفيديو داخل المنصة.</p>
          <p className="max-w-md text-sm leading-7 text-white/70">
            قد يكون الرابط يمنع التشغيل المدمج. يمكنك فتحه في نافذة جديدة الآن، وسنظل محتفظين بالدرس داخل المنصة.
          </p>
          <a
            href="#"
            aria-hidden="true"
            tabIndex={-1}
            className="hidden px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition-colors font-bold"
          >
            فتح الفيديو في نافذة جديدة
          </a>
        </div>
      )}

      {!usesNativeIframe && (
      <div className="absolute inset-0 z-10 cursor-pointer" onClick={handlePlayPause}>
        <AnimatePresence>
          {!playing && !hasPlaybackError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.5 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-20 h-20 bg-indigo-600/80 rounded-full flex items-center justify-center text-white shadow-2xl">
                <Play size={40} fill="currentColor" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {title ? (
        <div className="pointer-events-none absolute left-4 right-4 top-4 z-20 rounded-2xl bg-black/35 px-4 py-2 text-right text-sm font-bold text-white backdrop-blur" dir="rtl">
          {title}
        </div>
      ) : null}

      {activeQuestion ? (
        <VideoQuestionOverlay
          question={activeQuestion}
          bankQuestion={questionBank.find((question) => question.id === activeQuestion.questionId)}
          onAnswer={resolveQuestion}
          onSkip={() => resolveQuestion(true)}
        />
      ) : null}

      {!usesNativeIframe && (
      <motion.div
        initial={false}
        animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 20 }}
        className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 sm:p-4 md:p-6 pt-16 sm:pt-20"
      >
        <div className="relative group/progress mb-4">
          <input
            type="range"
            min={0}
            max={0.999999}
            step="any"
            value={played}
            onMouseDown={() => setSeeking(true)}
            onTouchStart={() => setSeeking(true)}
            onChange={(event) => setPlayed(parseFloat(event.target.value))}
            onMouseUp={handleSeekMouseUp}
            onTouchEnd={handleSeekMouseUp}
            className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:h-2 transition-all"
            style={{
              background: `linear-gradient(to right, #6366f1 ${played * 100}%, rgba(255,255,255,0.2) ${played * 100}%)`,
            }}
          />
        </div>

        <div className="flex flex-col gap-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6">
            <button onClick={handlePlayPause} className="hover:text-indigo-400 transition-colors" aria-label={playing ? 'إيقاف' : 'تشغيل'}>
              {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>

            <div className="hidden sm:flex items-center gap-4">
              <button onClick={() => seekBySeconds(-10)} className="hover:text-indigo-400 transition-colors" aria-label="رجوع 10 ثوان">
                <SkipBack size={20} />
              </button>
              <button onClick={() => seekBySeconds(10)} className="hover:text-indigo-400 transition-colors" aria-label="تقديم 10 ثوان">
                <SkipForward size={20} />
              </button>
            </div>

            <div className="text-xs md:text-sm font-medium font-mono whitespace-nowrap">
              {formatTime(played * duration)} / {formatTime(duration)}
            </div>

            <div className="hidden sm:flex items-center gap-2 group/volume">
              <button onClick={() => setMuted((value) => !value)} className="hover:text-indigo-400 transition-colors" aria-label="الصوت">
                {muted || volume === 0 ? <VolumeX size={20} /> : volume < 0.5 ? <Volume1 size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step="any"
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover/volume:w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white transition-all overflow-hidden"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 sm:justify-end md:gap-6">
            <button className="hidden sm:inline-flex hover:text-indigo-400 transition-colors" aria-label="الإعدادات">
              <Settings size={20} />
            </button>
            <button onClick={() => setMuted((value) => !value)} className="sm:hidden hover:text-indigo-400 transition-colors" aria-label="الصوت">
              {muted || volume === 0 ? <VolumeX size={20} /> : volume < 0.5 ? <Volume1 size={20} /> : <Volume2 size={20} />}
            </button>
            <button onClick={toggleFullscreen} className="hover:text-indigo-400 transition-colors" aria-label={isFullscreen ? 'إغلاق الشاشة الكاملة' : 'شاشة كاملة'}>
              <Maximize size={20} />
            </button>
          </div>
        </div>
      </motion.div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            input[type=range]::-webkit-slider-thumb {
              -webkit-appearance: none;
              height: 12px;
              width: 12px;
              border-radius: 50%;
              background: white;
              cursor: pointer;
              box-shadow: 0 0 10px rgba(0,0,0,0.5);
            }
            input[type=range]::-moz-range-thumb {
              height: 12px;
              width: 12px;
              border-radius: 50%;
              background: white;
              cursor: pointer;
              border: none;
            }
          `,
        }}
      />
    </div>
  );
};

import { useRef, useState, useEffect } from 'react';

interface VideoPlayerProps {
  videoUrl: string;
}

export function VideoPlayer({ videoUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      const progress = (video.currentTime / video.duration) * 100;
      setProgress(progress);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };

    const handleError = () => {
      setError('Error loading video');
      setIsLoading(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setError(null);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);
    video.addEventListener('loadstart', handleLoadStart);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadstart', handleLoadStart);
    };
  }, []);

  const togglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;

    const bounds = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const width = bounds.width;
    const percentage = x / width;
    const newTime = percentage * duration;

    videoRef.current.currentTime = newTime;
    setProgress(percentage * 100);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col space-y-2 max-w-lg">
      <div className="relative rounded-lg overflow-hidden bg-gray-900">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
            <div className="text-white bg-red-500 px-4 py-2 rounded-lg">{error}</div>
          </div>
        )}
        <video
          ref={videoRef}
          src={videoUrl}
          className="rounded-lg w-full"
          playsInline
          onClick={togglePlayPause}
          style={{ cursor: 'pointer' }}
        />
      </div>
      <div className="flex flex-col space-y-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center space-x-4">
          <button
            onClick={togglePlayPause}
            className="text-2xl text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶️'}
          </button>
          <div 
            className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden cursor-pointer"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 min-w-[80px] text-right">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>
    </div>
  );
} 
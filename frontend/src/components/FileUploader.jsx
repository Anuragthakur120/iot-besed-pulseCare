import React, { useRef, useState } from 'react';
import { UploadCloud, Image, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Accessible Drag & Drop File Uploader with Image Preview and Progress Bar
 */
export function FileUploader({
  accept = 'image/jpeg,image/png,image/webp',
  maxSizeMb = 2,
  onFileSelect,
  previewUrl,
  onRemove,
  progress = null, // number 0-100 or null
  className
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = (file) => {
    setError(null);
    if (!file) return;

    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File size exceeds maximum limit of ${maxSizeMb} MB`);
      return;
    }

    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className={cn('w-full space-y-2 text-left', className)}>
      {previewUrl ? (
        <div className="relative inline-block rounded-card border border-[#E5EAF1] dark:border-slate-800 overflow-hidden shadow-soft group">
          <img src={previewUrl} alt="Preview" className="w-36 h-36 object-cover" />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove uploaded file"
              className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-rose-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-card cursor-pointer transition-all duration-150 text-center select-none',
            isDragOver
              ? 'border-teal-500 bg-teal-500/5'
              : 'border-[#E5EAF1] dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-teal-500/50 hover:bg-slate-50 dark:hover:bg-slate-900/60'
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2">
            <UploadCloud className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-[#0B1F3A] dark:text-slate-200">
            Click to upload or drag & drop
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            JPEG, PNG or WebP (max {maxSizeMb} MB)
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      {/* Progress Bar */}
      {progress !== null && progress >= 0 && (
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span>Uploading photo...</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
}

export default FileUploader;

import React, { useCallback, useRef, useState } from 'react';
import { Upload, CheckCircle2, X, HardDrive, AlertCircle } from 'lucide-react';

const MAX_MB = 500;
const WARN_MB = 200;

function mbSize(file) { return file ? file.size / 1024 / 1024 : 0; }

export default function DropZone({
  label,
  accept,
  icon: Icon = Upload,
  file,
  onFile,
  onClear,
  testid,
  disabled = false,
  showLimit = false,
  limitMB,
  error = null,
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const isWarn = file && mbSize(file) > WARN_MB;
  const isOver = file && mbSize(file) > MAX_MB;

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [disabled, onFile]);

  let stateClass = '';
  if (error) stateClass = 'error-state';
  else if (file) stateClass = 'file-selected';
  else if (dragging) stateClass = 'drag-over';

  return (
    <div
      className={`dropzone-card ${stateClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      data-testid={testid}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && !disabled && inputRef.current?.click()}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-label={`Upload ${label}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => e.target.files?.[0] && onFile(e.target.files[0])}
      />

      {file && onClear && !disabled && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onClear(); }}
          className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          aria-label="Remove file"
        >
          <X size={12} />
        </button>
      )}

      {file ? (
        <>
          <CheckCircle2 size={20} className={isOver ? 'text-red-400' : isWarn ? 'text-orange-400' : 'text-teal-400'} />
          <span className={`text-xs font-mono break-all max-w-full px-4 line-clamp-2 ${
            isOver ? 'text-red-300' : isWarn ? 'text-orange-300' : 'text-teal-300'
          }`}>{file.name}</span>
          <span className={`text-xs font-medium ${
            isOver ? 'text-red-400' : isWarn ? 'text-orange-400' : 'text-muted-foreground'
          }`}>
            {mbSize(file).toFixed(1)} MB{isOver ? ' — too large' : isWarn ? ' — large' : ''}
          </span>
        </>
      ) : (
        <>
          {error ? (
            <AlertCircle size={20} className="text-red-400" />
          ) : (
            <Icon size={20} className="text-muted-foreground" />
          )}
          <div>
            <p className={`text-sm font-medium ${error ? 'text-red-300' : 'text-foreground'}`}>{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{accept.replace('.', '').toUpperCase()} format</p>
          </div>
          {showLimit && limitMB && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
              <HardDrive size={10} />
              <span>Max {limitMB} MB</span>
            </div>
          )}
          {!showLimit && (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Click or drag here</p>
          )}
        </>
      )}
    </div>
  );
}

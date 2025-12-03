import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Maximize, Move, ChevronLeft, ChevronRight } from 'lucide-react';
import { GeneratedImage } from '../types';

interface ViewableImage {
    url: string;
    title?: string;
    metadata?: string;
    id?: string;
    originalFilename?: string;
    optionsUsed?: string;
}

interface Props {
  image: ViewableImage | GeneratedImage | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

const ImageDetailDialog: React.FC<Props> = ({ image, onClose, onNext, onPrev, hasNext, hasPrev }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to normalize data props
  const getTitle = () => {
      if (!image) return "";
      return (image as GeneratedImage).originalFilename || (image as ViewableImage).title || "Image Viewer";
  };
  
  const getMetadata = () => {
      if (!image) return "";
      return (image as GeneratedImage).optionsUsed || (image as ViewableImage).metadata || "";
  };

  // Reset state when image opens
  useEffect(() => {
    if (image) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [image]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (!image) return;
          if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
          if (e.key === 'ArrowLeft' && hasPrev && onPrev) onPrev();
          if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [image, hasNext, hasPrev, onNext, onPrev, onClose]);

  if (!image) return null;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleChange = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(0.5, scale + scaleChange), 5);
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm">
      <div 
        className="relative w-[90vw] h-[90vh] bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-950 z-10">
          <div className="flex items-center gap-4 overflow-hidden">
            <h3 className="text-emerald-400 font-bold truncate max-w-md">{getTitle()}</h3>
            <span className="text-xs text-slate-500 truncate max-w-xl border-l border-slate-800 pl-4">
                {getMetadata()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-800 rounded-lg px-2 py-1 mr-4">
               <span className="text-xs text-slate-400 mr-2">
                   {(scale * 100).toFixed(0)}%
               </span>
               <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1 hover:text-white text-slate-400"><ZoomOut size={16}/></button>
               <button onClick={() => setScale(1)} className="p-1 hover:text-white text-slate-400"><Maximize size={16}/></button>
               <button onClick={() => setScale(s => Math.min(5, s + 0.25))} className="p-1 hover:text-white text-slate-400"><ZoomIn size={16}/></button>
            </div>
            <button 
                onClick={onClose} 
                className="p-2 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
                <X size={20} />
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div 
            ref={containerRef}
            className="flex-1 overflow-hidden relative bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] bg-slate-900 cursor-move group"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div className="absolute top-4 left-4 z-10 pointer-events-none opacity-50">
               <div className="bg-black/50 p-2 rounded text-xs text-white flex gap-2 items-center">
                   <Move size={12}/> <span>Drag to pan, Scroll to zoom</span>
               </div>
            </div>

            {/* Navigation Overlays */}
            {hasPrev && (
                <div 
                    onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 p-4 cursor-pointer hover:bg-black/20 z-20 text-slate-600 hover:text-white transition-colors h-full flex items-center"
                >
                    <ChevronLeft size={48} />
                </div>
            )}
            {hasNext && (
                <div 
                    onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-4 cursor-pointer hover:bg-black/20 z-20 text-slate-600 hover:text-white transition-colors h-full flex items-center"
                >
                    <ChevronRight size={48} />
                </div>
            )}

            <div 
                className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
                }}
            >
                <img 
                    ref={imageRef}
                    src={image.url} 
                    alt="Detail view" 
                    draggable={false}
                    className="max-w-full max-h-full object-contain shadow-2xl shadow-black" 
                />
            </div>
        </div>
      </div>
    </div>
  );
};

export default ImageDetailDialog;
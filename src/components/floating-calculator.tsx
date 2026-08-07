'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, GripVertical, Minus, Calculator as CalcIcon } from 'lucide-react';
import { Calculator } from './calculator';
import { useFloatingCalculator } from '@/hooks/use-floating-calculator';

export function FloatingCalculator() {
  const { isOpen, setIsOpen, isMinimized, setIsMinimized, onUseResult } = useFloatingCalculator();
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const dragRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Initial positioning in the bottom-right corner of the viewport
    const updateInitialPosition = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setPosition({ x: width - 340, y: height - 540 });
    };

    updateInitialPosition();
    window.addEventListener('resize', updateInitialPosition);
    return () => window.removeEventListener('resize', updateInitialPosition);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only trigger on left-click
    isDragging.current = true;
    offset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    
    // Bounds check to ensure the calculator stays inside the viewport boundaries
    const newX = Math.max(10, Math.min(window.innerWidth - 330, e.clientX - offset.current.x));
    const newY = Math.max(10, Math.min(window.innerHeight - 510, e.clientY - offset.current.y));
    
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Touch handlers for mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    isDragging.current = true;
    offset.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    };
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging.current) return;
    const touch = e.touches[0];
    
    const newX = Math.max(10, Math.min(window.innerWidth - 330, touch.clientX - offset.current.x));
    const newY = Math.max(10, Math.min(window.innerHeight - 510, touch.clientY - offset.current.y));
    
    setPosition({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Minimized Bubble */}
      {isMinimized && (
        <button
          onClick={() => setIsMinimized(false)}
          data-calculator="floating"
          className="fixed bottom-6 right-6 z-[9999] h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center border hover:scale-105 active:scale-95 transition-all duration-200 no-print pointer-events-auto"
          style={{ pointerEvents: 'auto' }}
          title="Maximize Calculator"
        >
          <CalcIcon className="h-6 w-6" />
        </button>
      )}

      {/* Maximized Window */}
      <div 
        ref={dragRef}
        data-calculator="floating"
        onMouseDown={() => {
          if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
            document.activeElement.blur();
          }
        }}
        onTouchStart={() => {
          if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
            document.activeElement.blur();
          }
        }}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 9999,
          touchAction: 'none',
          pointerEvents: isMinimized ? 'none' : 'auto'
        }}
        className={`w-[320px] bg-background border rounded-xl shadow-2xl overflow-hidden select-none no-print pointer-events-auto transition-all duration-200 ${
          isMinimized ? 'scale-0 opacity-0 pointer-events-none origin-bottom-right' : 'scale-100 opacity-100'
        }`}
      >
      {/* Drag handle / Titlebar */}
      <div 
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="bg-primary text-primary-foreground p-3 flex justify-between items-center cursor-move"
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <GripVertical className="h-4 w-4 opacity-75" />
          <span>Calculator</span>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsMinimized(true)}
            className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsOpen(false)}
            className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-1">
        <Calculator onUseResult={(val) => {
          if (onUseResult) {
            onUseResult(val);
          }
        }} />
      </div>
    </div>
  </>
  );
}

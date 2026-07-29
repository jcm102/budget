'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, GripVertical } from 'lucide-react';
import { Calculator } from './calculator';
import { useFloatingCalculator } from '@/hooks/use-floating-calculator';

export function FloatingCalculator() {
  const { isOpen, setIsOpen } = useFloatingCalculator();
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
    <div 
      ref={dragRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
        touchAction: 'none'
      }}
      className="w-[320px] bg-background border rounded-xl shadow-2xl overflow-hidden select-none no-print"
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
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsOpen(false)}
          className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-1">
        <Calculator />
      </div>
    </div>
  );
}

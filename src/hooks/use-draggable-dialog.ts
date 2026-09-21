'use client';

import { useState, useRef, useEffect } from 'react';

export function useDraggableDialog() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  // Clean up user-select if unmounted mid-drag
  useEffect(() => {
    return () => {
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button (left-click or single touch)
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;

    // Do not drag if clicking on interactive elements
    if (
      target.closest(
        'button, input, textarea, select, a, [role="button"], [role="switch"], [role="checkbox"], [role="tab"], [role="menuitem"], [data-no-drag]'
      )
    ) {
      return;
    }

    // Only initiate drag if clicking the top drag handle or dialog header
    const isDragArea = target.closest('[data-dialog-handle], [data-dialog-header], header');
    if (!isDragArea) return;

    e.preventDefault();
    e.stopPropagation();

    // Prevent background text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    window.getSelection()?.removeAllRanges();

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };

    setIsDragging(true);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    e.preventDefault();

    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    // Clamp within viewport so the dialog header always stays accessible
    const maxBoundX = Math.max(100, window.innerWidth / 2 - 60);
    const maxBoundY = Math.max(100, window.innerHeight / 2 - 50);

    const newX = Math.max(-maxBoundX, Math.min(maxBoundX, dragStartRef.current.initialX + dx));
    const newY = Math.max(-maxBoundY, Math.min(maxBoundY, dragStartRef.current.initialY + dy));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    setIsDragging(false);

    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return {
    position,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}

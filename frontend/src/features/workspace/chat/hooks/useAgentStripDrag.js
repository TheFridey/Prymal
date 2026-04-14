import { useRef } from 'react';

/**
 * Manages the horizontal drag-to-scroll + momentum behaviour on the agent strip.
 */
export function useAgentStripDrag() {
  const agentStripRef = useRef(null);
  const dragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startScrollLeft: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    frame: null,
    moved: false,
    suppressClick: false,
  });

  function stopMomentum() {
    if (dragRef.current.frame) {
      cancelAnimationFrame(dragRef.current.frame);
      dragRef.current.frame = null;
    }
  }

  function startMomentum() {
    const strip = agentStripRef.current;
    if (!strip) return;
    stopMomentum();

    const tick = () => {
      dragRef.current.velocity *= 0.92;
      if (Math.abs(dragRef.current.velocity) < 0.2) {
        dragRef.current.frame = null;
        return;
      }
      strip.scrollLeft -= dragRef.current.velocity;
      dragRef.current.frame = requestAnimationFrame(tick);
    };

    dragRef.current.frame = requestAnimationFrame(tick);
  }

  function handlePointerDown(event) {
    const strip = agentStripRef.current;
    if (!strip) return;

    const pressedPill = event.target instanceof Element
      ? event.target.closest('.workspace-studio__agent-pill')
      : null;

    if (pressedPill) {
      dragRef.current.active = false;
      dragRef.current.pointerId = null;
      dragRef.current.moved = false;
      dragRef.current.suppressClick = false;
      return;
    }

    stopMomentum();
    dragRef.current.active = true;
    dragRef.current.pointerId = event.pointerId;
    dragRef.current.startX = event.clientX;
    dragRef.current.startScrollLeft = strip.scrollLeft;
    dragRef.current.lastX = event.clientX;
    dragRef.current.lastTime = performance.now();
    dragRef.current.velocity = 0;
    dragRef.current.moved = false;
    dragRef.current.suppressClick = false;
  }

  function handlePointerMove(event) {
    const strip = agentStripRef.current;
    if (!strip || !dragRef.current.active) return;

    const delta = event.clientX - dragRef.current.startX;
    if (!dragRef.current.moved && Math.abs(delta) < 10) return;

    if (!dragRef.current.moved && dragRef.current.pointerId != null) {
      strip.setPointerCapture?.(dragRef.current.pointerId);
    }

    dragRef.current.moved = true;
    strip.scrollLeft = dragRef.current.startScrollLeft - delta;

    const now = performance.now();
    const distance = event.clientX - dragRef.current.lastX;
    const elapsed = Math.max(now - dragRef.current.lastTime, 1);
    dragRef.current.velocity = (distance / elapsed) * 18;
    dragRef.current.lastX = event.clientX;
    dragRef.current.lastTime = now;
  }

  function handlePointerEnd() {
    const strip = agentStripRef.current;
    if (!dragRef.current.active) return;

    dragRef.current.active = false;
    if (strip && dragRef.current.pointerId != null) {
      strip.releasePointerCapture?.(dragRef.current.pointerId);
    }
    dragRef.current.pointerId = null;
    dragRef.current.suppressClick = dragRef.current.moved;
    if (dragRef.current.moved) {
      startMomentum();
    }
  }

  function handleWheel(event) {
    const strip = agentStripRef.current;
    if (!strip) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      strip.scrollLeft += event.deltaY;
      event.preventDefault();
    }
  }

  return {
    agentStripRef,
    agentStripDragRef: dragRef,
    stopMomentum,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleWheel,
  };
}

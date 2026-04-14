import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MotionList, MotionListItem } from './motion';
import {
  createCommandPaletteActionStyle,
  createCommandPaletteBackdropStyle,
  createCommandPaletteDialogStyle,
  createCommandPaletteKindStyle,
} from '../design-system/surfaces';

function paletteKey(item) {
  return `${item.kind ?? 'item'}:${item.id ?? item.title}`;
}

export function CommandPaletteDialog({
  title = 'Command palette',
  query,
  onQueryChange,
  placeholder = 'Search...',
  results = [],
  onSelect,
  onClose,
  emptyLabel = 'No matching results.',
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, results.length]);

  useEffect(() => {
    const activeElement = listRef.current?.children?.[activeIndex];
    activeElement?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = results[activeIndex];
      if (selected) {
        onSelect(selected);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="command-palette-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={onClose}
        style={createCommandPaletteBackdropStyle()}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(event) => event.stopPropagation()}
          style={createCommandPaletteDialogStyle()}
        >
          <div
            style={{
              padding: '18px 20px 14px',
              borderBottom: '1px solid var(--line)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--muted)' }}>
                  Jump surface
                </div>
                <div style={{ color: 'var(--text-strong)', fontSize: '1.1rem', fontWeight: 700 }}>{title}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: '999px',
                  background: 'transparent',
                  color: 'var(--muted)',
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Esc
              </button>
            </div>

            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              style={{
                width: '100%',
                border: '1px solid var(--line)',
                borderRadius: '18px',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-strong)',
                padding: '14px 16px',
                fontSize: '0.96rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <MotionList
            ref={listRef}
            staggerChildren={0.04}
            style={{
              maxHeight: '440px',
              overflowY: 'auto',
              padding: '10px',
              display: 'grid',
              gap: '6px',
            }}
          >
            {results.length === 0 ? (
              <div
                style={{
                  padding: '28px 18px 32px',
                  textAlign: 'center',
                  color: 'var(--muted)',
                  lineHeight: 1.7,
                }}
              >
                {emptyLabel}
              </div>
            ) : (
              results.map((result, index) => {
                const active = index === activeIndex;
                return (
                  <MotionListItem key={paletteKey(result)} reveal={{ y: 6, blur: 2 }}>
                  <button
                    type="button"
                    onClick={() => onSelect(result)}
                    onMouseEnter={() => setActiveIndex(index)}
                    style={createCommandPaletteActionStyle(active)}
                  >
                    <span style={createCommandPaletteKindStyle(result.accent)}>
                      {result.kindLabel ?? result.kind ?? 'Item'}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.92rem',
                          fontWeight: 650,
                          color: 'var(--text-strong)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {result.title}
                      </span>
                      {result.subtitle ? (
                        <span
                          style={{
                            display: 'block',
                            marginTop: '2px',
                            fontSize: '0.8rem',
                            color: 'var(--muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {result.subtitle}
                        </span>
                      ) : null}
                    </span>
                    <span
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.74rem',
                        border: '1px solid var(--line)',
                        borderRadius: '999px',
                        padding: '4px 8px',
                      }}
                    >
                      Enter
                    </span>
                  </button>
                  </MotionListItem>
                );
              })
            )}
          </MotionList>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

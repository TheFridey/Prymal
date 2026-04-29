import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TbArrowRight, TbMapPin, TbMessageCircle, TbSearch } from 'react-icons/tb';
import { AgentAvatar } from './ui';
import { createCommandPaletteBackdropStyle, createCommandPaletteDialogStyle } from '../design-system/surfaces';

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
            className="command-palette__header"
          >
            <div className="command-palette__title-row">
              <div>
                <div className="command-palette__eyebrow">
                  Jump surface
                </div>
                <div className="command-palette__title">{title}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="command-palette__esc"
              >
                Esc
              </button>
            </div>

            <label className="command-palette__search">
              <TbSearch aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
              />
            </label>
          </div>

          <div
            ref={listRef}
            className="command-palette__list"
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
                  <div key={paletteKey(result)} className="command-palette__list-item">
                    <button
                      type="button"
                      onClick={() => onSelect(result)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`command-palette__item${active ? ' is-active' : ''}`}
                      style={{ '--command-accent': result.accent ?? 'var(--accent)' }}
                    >
                      <ResultVisual result={result} />
                      <span className="command-palette__copy">
                        <span className="command-palette__meta">
                          <span>{result.kindLabel ?? result.kind ?? 'Item'}</span>
                          {result.meta ? <span>{result.meta}</span> : null}
                        </span>
                        <span className="command-palette__result-title">{result.title}</span>
                        {result.subtitle ? (
                          <span className="command-palette__subtitle">{result.subtitle}</span>
                        ) : null}
                      </span>
                      <span className="command-palette__enter">
                        <span>Enter</span>
                        <TbArrowRight aria-hidden="true" />
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ResultVisual({ result }) {
  if (result.agent) {
    return (
      <span className="command-palette__visual command-palette__visual--avatar">
        <AgentAvatar agent={result.agent} size={44} />
        {result.kind === 'conversation' ? (
          <span className="command-palette__visual-badge">
            <TbMessageCircle aria-hidden="true" />
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="command-palette__visual command-palette__visual--badge">
      {result.kind === 'conversation' ? <TbMessageCircle aria-hidden="true" /> : <TbMapPin aria-hidden="true" />}
      <span>{result.code ?? result.kindLabel ?? 'Go'}</span>
    </span>
  );
}

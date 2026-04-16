import { useEffect, useRef } from 'react';

const AGENT_PALETTE = ['#00FFD1', '#C77DFF', '#FF6B35', '#80FFDB', '#F72585', '#FFD60A', '#4CC9F0'];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createStars(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: randomBetween(0.5, 2),
    baseOpacity: randomBetween(0.1, 0.8),
    twinklePeriod: randomBetween(3000, 8000),
    twinkleOffset: Math.random() * 8000,
    driftSpeed: randomBetween(0.05, 0.15),
  }));
}

function createOrbs(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: randomBetween(8, 20),
    color: AGENT_PALETTE[Math.floor(Math.random() * AGENT_PALETTE.length)],
    opacity: randomBetween(0.06, 0.18),
    dx: randomBetween(-0.15, 0.15) || 0.05,
    dy: randomBetween(-0.15, 0.15) || 0.05,
  }));
}

export function MagicalCanvas({ reducedMotion = false }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);

  useEffect(() => {
    if (reducedMotion) return undefined;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let animationId = 0;
    let lastScrollY = window.scrollY;

    const stars = createStars(200);
    const orbs = createOrbs(15);
    const trails = [];

    stateRef.current = { stars, orbs, trails };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener('resize', resize);

    function handleScroll() {
      const dy = Math.abs(window.scrollY - lastScrollY);
      lastScrollY = window.scrollY;
      if (dy > 2 && trails.length < 40) {
        const count = Math.min(Math.ceil(dy / 20), 5);
        for (let i = 0; i < count && trails.length < 40; i++) {
          trails.push({
            x: Math.random() * window.innerWidth,
            y: window.innerHeight + 10,
            opacity: 1,
            born: performance.now(),
          });
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });

    const w = () => window.innerWidth;
    const h = () => window.innerHeight;

    function draw(now) {
      ctx.clearRect(0, 0, w(), h());

      for (const star of stars) {
        star.y -= star.driftSpeed / h();
        if (star.y < -0.02) star.y = 1.02;

        const twinkle = 0.5 + 0.5 * Math.sin(((now + star.twinkleOffset) / star.twinklePeriod) * Math.PI * 2);
        const opacity = star.baseOpacity * (0.4 + 0.6 * twinkle);

        ctx.beginPath();
        ctx.arc(star.x * w(), star.y * h(), star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.fill();
      }

      for (const orb of orbs) {
        orb.x += orb.dx / w();
        orb.y += orb.dy / h();

        if (orb.x < 0 || orb.x > 1) orb.dx *= -1;
        if (orb.y < 0 || orb.y > 1) orb.dy *= -1;
        orb.x = Math.max(0, Math.min(1, orb.x));
        orb.y = Math.max(0, Math.min(1, orb.y));

        const px = orb.x * w();
        const py = orb.y * h();

        ctx.save();
        ctx.globalAlpha = orb.opacity;
        ctx.beginPath();
        ctx.arc(px, py, orb.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = orb.color;
        ctx.filter = 'blur(18px)';
        ctx.fill();
        ctx.filter = 'none';
        ctx.restore();
      }

      for (let i = trails.length - 1; i >= 0; i--) {
        const trail = trails[i];
        const age = (now - trail.born) / 1500;
        if (age >= 1) {
          trails.splice(i, 1);
          continue;
        }
        trail.y -= 1.2;
        trail.opacity = 1 - age;
        const size = 2 * (1 - age * 0.5);

        ctx.beginPath();
        ctx.arc(trail.x, trail.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,215,0,${trail.opacity * 0.7})`;
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    }

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}

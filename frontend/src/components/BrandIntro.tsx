import { useEffect, useState } from 'react';
import { Brand } from './Brand.tsx';

export function BrandIntro({ persistent = false }: { persistent?: boolean }) {
  const [visible, setVisible] = useState(
    () => persistent || !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (!visible || persistent) return;

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const dismiss = () => setVisible(false);
    const handleMotionChange = () => {
      if (motionPreference.matches) dismiss();
    };
    const timeout = window.setTimeout(dismiss, 1100);

    window.addEventListener('pointerdown', dismiss, { capture: true, passive: true });
    window.addEventListener('keydown', dismiss, true);
    motionPreference.addEventListener('change', handleMotionChange);
    handleMotionChange();

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('keydown', dismiss, true);
      motionPreference.removeEventListener('change', handleMotionChange);
    };
  }, [visible, persistent]);

  if (!visible) return null;

  return (
    <div
      className={persistent ? "brand-intro brand-intro-persistent" : "brand-intro"}
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'brand-intro-fade') {
          setVisible(false);
        }
      }}
    >
      <Brand compact />
    </div>
  );
}

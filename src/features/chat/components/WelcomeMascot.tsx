import { useEffect, useRef } from 'react';
import './WelcomeMascot.css';

/** Decorative companion: pointer updates never re-render the chat tree. */
export function WelcomeMascot() {
  const host = useRef<HTMLDivElement>(null);
  const gaze = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let x = 0;
    let y = 0;
    let focused = false;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      host.current?.style.setProperty('--look-x', '0px');
      host.current?.style.setProperty('--look-y', focused ? '3px' : '0px');
    };
    const draw = () => {
      frame = 0;
      if (!host.current || !gaze.current) return;
      const rect = host.current.getBoundingClientRect();
      const dx = x - rect.left - rect.width / 2;
      const dy = y - rect.top - rect.height / 2;
      const distance = Math.hypot(dx, dy);
      const strength = Math.min(distance / 160, 1);
      host.current.style.setProperty('--look-x', `${distance ? dx / distance * strength * 4 : 0}px`);
      host.current.style.setProperty('--look-y', `${distance ? dy / distance * strength * 3 : 0}px`);
    };
    const move = (event: PointerEvent) => {
      if (focused || preference.matches || event.pointerType === 'touch') return;
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const focus = (event: FocusEvent) => {
      focused = event.type === 'focusin' && event.target instanceof HTMLTextAreaElement;
      host.current?.classList.toggle('is-focused', focused);
      reset();
    };
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', focus);
    const visibility = () => { if (document.hidden) reset(); };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', reset);
    document.documentElement.addEventListener('pointerleave', reset);
    document.addEventListener('visibilitychange', visibility);
    preference.addEventListener('change', reset);
    return () => {
      reset();
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', focus);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('blur', reset);
      document.documentElement.removeEventListener('pointerleave', reset);
      document.removeEventListener('visibilitychange', visibility);
      preference.removeEventListener('change', reset);
    };
  }, []);

  return <div className="welcome-mascot" ref={host} aria-hidden="true">
    <span className="welcome-mascot-shadow" />
    <div className="welcome-mascot-body">
      <span className="welcome-mascot-cheek welcome-mascot-cheek--left" />
      <span className="welcome-mascot-cheek welcome-mascot-cheek--right" />
      <div className="welcome-mascot-face" ref={gaze}>
        <span className="welcome-mascot-eye"><i /></span>
        <span className="welcome-mascot-eye"><i /></span>
        <span className="welcome-mascot-mouth" />
      </div>
    </div>
    <span className="welcome-mascot-spark" />
  </div>;
}

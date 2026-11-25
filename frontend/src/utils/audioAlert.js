/**
 * PulseCare Soft Audio Beep Generator using Web Audio API
 * Generates calm, hospital-grade telemetry alert chimes without external asset dependencies.
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function isAudioMuted() {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('pulsecare_audio_muted') === 'true';
}

export function setAudioMuted(muted) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('pulsecare_audio_muted', muted ? 'true' : 'false');
}

/**
 * Play a calm clinical two-tone alert chime (e.g. A5 -> C#6)
 * @param {'warning'|'critical'|'info'} severity
 */
export function playAlertBeep(severity = 'warning') {
  if (isAudioMuted()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';

    if (severity === 'critical') {
      // Rapid two-pulse chime
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(1174.66, now + 0.12); // D6
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      // Gentle harmonic chime
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(880, now + 0.15); // A5
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    }
  } catch (err) {
    console.warn('[AudioAlert] Web Audio playback failed or blocked:', err);
  }
}

/**
 * Trigger Native Browser Notification
 */
export function triggerBrowserNotification(alert) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    new Notification(`[PulseCare ${alert.severity?.toUpperCase() || 'ALERT'}] ${alert.type}`, {
      body: `Vital reading breach: ${JSON.stringify(alert.value || 'Alert triggered')}`,
      icon: '/vite.svg',
      tag: alert._id || 'pulsecare-alert'
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

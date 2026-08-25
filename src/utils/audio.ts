let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      audioContext = new AudioCtx();
    }
  }
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

export function playBeep(type: "success" | "warning" | "error"): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === "success") {
      // Pleasant double chime
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "warning") {
      // Warning chime
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(370, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      // Error buzz
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.setValueAtTime(130, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch {
    // Graceful fallback if audio is blocked
  }
}

export function speakArabicGreeting(studentName: string, enabled = true): void {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const cleanName = studentName.split(" ")[0] || studentName;
    const utterance = new SpeechSynthesisUtterance(`أهلاً ${cleanName}`);
    utterance.lang = "ar-EG";
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech errors
  }
}

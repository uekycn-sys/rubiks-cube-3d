/**
 * Pure Web Audio API Sound Synthesizer
 * Zero external audio assets! Synthesizes authentic magnetic tactile clicks,
 * wooden snaps, and victory chord progressions procedurally.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted = false;

  constructor() {
    // Check saved mute preference
    if (typeof localStorage !== 'undefined') {
      this.isMuted = localStorage.getItem('cube_muted') === 'true';
    }
  }

  private getContext(): AudioContext | null {
    if (this.isMuted) return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cube_muted', String(this.isMuted));
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Mechanical magnetic snap sound on move completion
   * Dual layer: High frequency transient click + hollow tactile damping
   */
  public playSnap(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    // Layer 1: High transient magnetic click
    const oscHigh = ctx.createOscillator();
    const gainHigh = ctx.createGain();
    const filterHigh = ctx.createBiquadFilter();

    oscHigh.type = 'triangle';
    oscHigh.frequency.setValueAtTime(2200, t);
    oscHigh.frequency.exponentialRampToValueAtTime(300, t + 0.04);

    filterHigh.type = 'bandpass';
    filterHigh.frequency.setValueAtTime(1800, t);
    filterHigh.Q.setValueAtTime(3.0, t);

    gainHigh.gain.setValueAtTime(0.35, t);
    gainHigh.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    oscHigh.connect(filterHigh);
    filterHigh.connect(gainHigh);
    gainHigh.connect(ctx.destination);

    oscHigh.start(t);
    oscHigh.stop(t + 0.05);

    // Layer 2: Hollow low mechanical thud
    const oscLow = ctx.createOscillator();
    const gainLow = ctx.createGain();

    oscLow.type = 'sine';
    oscLow.frequency.setValueAtTime(340, t);
    oscLow.frequency.exponentialRampToValueAtTime(80, t + 0.06);

    gainLow.gain.setValueAtTime(0.25, t);
    gainLow.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    oscLow.connect(gainLow);
    gainLow.connect(ctx.destination);

    oscLow.start(t);
    oscLow.stop(t + 0.07);
  }

  /**
   * Light tactile tap when clicking colors or UI buttons
   */
  public playClick(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(250, t + 0.025);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.03);
  }

  /**
   * Tonal chime when successfully painting a tile
   */
  public playPaint(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, t); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, t + 0.05); // E5

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.07);
  }

  /**
   * Rich celebratory major arpeggio / victory chord (C4, E4, G4, B4, C5)
   */
  public playVictory(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [261.63, 329.63, 392.0, 493.88, 523.25, 659.25]; // C4, E4, G4, B4, C5, E5
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const t = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.65);
    });
  }

  /**
   * Low double thud for error or invalid action
   */
  public playError(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.08);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.09);
  }
}

export const soundManager = new SoundManager();

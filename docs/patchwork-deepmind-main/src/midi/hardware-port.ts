import midi from 'midi';
import { EventEmitter } from 'events';

export type SysExMessage = Uint8Array;

export type HardwareMidiPortOptions = {
  inputPortIndex: number;
  outputPortIndex: number;
  /** MIDI channel 0..15 (0 = channel 1). */
  channel: number;
  /** When true, input is configured to NOT ignore SysEx. */
  enableSysexReception: boolean;
};

export class HardwareMidiPort {
  private readonly input = new midi.Input();
  private readonly output = new midi.Output();

  private isOpen = false;

  readonly channel: number;

  constructor(private readonly opts: HardwareMidiPortOptions) {
    if (opts.channel < 0 || opts.channel > 15) {
      throw new Error(`Invalid MIDI channel ${opts.channel} (expected 0..15)`);
    }
    this.channel = opts.channel;
  }

  open(): void {
    if (this.isOpen) return;

    this.input.openPort(this.opts.inputPortIndex);
    this.output.openPort(this.opts.outputPortIndex);

    // Historical gotcha: SysEx is ignored by default in many bindings.
    // ignoreTypes(sysex, timing, activeSensing)
    if (this.opts.enableSysexReception) {
      this.input.ignoreTypes(false, false, false);
    }

    this.isOpen = true;
  }

  close(): void {
    if (!this.isOpen) return;

    try {
      this.input.closePort();
    } catch {
      // ignore
    }
    try {
      this.output.closePort();
    } catch {
      // ignore
    }

    this.isOpen = false;
  }

  sendBytes(message: Uint8Array): void {
    if (!this.isOpen) {
      throw new Error('MIDI port not open');
    }
    // @types/midi models sendMessage as a fixed 3-byte tuple (channel messages),
    // but node-midi supports variable-length arrays (e.g. SysEx).
    (this.output as unknown as { sendMessage: (msg: number[]) => void }).sendMessage(Array.from(message));
  }

  sendCc(cc: number, value: number, channel: number = this.channel): void {
    if (cc < 0 || cc > 127) throw new Error(`Invalid CC ${cc}`);
    if (value < 0 || value > 127) throw new Error(`Invalid CC value ${value}`);
    if (channel < 0 || channel > 15) throw new Error(`Invalid channel ${channel}`);
    const status = 0xb0 | (channel & 0x0f);
    this.sendBytes(Uint8Array.from([status, cc & 0x7f, value & 0x7f]));
  }

  onMessage(handler: (deltaTime: number, message: Uint8Array) => void): () => void {
    if (!this.isOpen) {
      throw new Error('MIDI port not open');
    }

    const wrapped = (deltaTime: number, message: number[]) => {
      handler(deltaTime, Uint8Array.from(message));
    };

    this.input.on('message', wrapped);

    return () => {
      (this.input as unknown as EventEmitter).removeListener('message', wrapped);
    };
  }

  async requestSysEx(request: Uint8Array, timeoutMs: number, predicate?: (msg: SysExMessage) => boolean): Promise<SysExMessage> {
    if (!this.isOpen) {
      throw new Error('MIDI port not open');
    }

    return await new Promise<SysExMessage>((resolve, reject) => {
      const start = Date.now();
      let timeout: NodeJS.Timeout | null = null;
      let dispose: (() => void) | null = null;

      const done = (err: Error | null, msg?: SysExMessage) => {
        if (timeout) clearTimeout(timeout);
        timeout = null;
        if (dispose) dispose();
        dispose = null;

        if (err) return reject(err);
        if (!msg) return reject(new Error('Internal error: missing SysEx message'));
        return resolve(msg);
      };

      dispose = this.onMessage((_dt, message) => {
        // SysEx is framed with 0xF0 ... 0xF7.
        if (message.length < 2) return;
        if (message[0] !== 0xf0 || message[message.length - 1] !== 0xf7) return;
        if (predicate && !predicate(message)) return;
        done(null, message);
      });

      timeout = setTimeout(() => {
        const elapsed = Date.now() - start;
        done(new Error(`Timed out waiting for SysEx response after ${elapsed}ms`));
      }, timeoutMs);

      this.sendBytes(request);
    });
  }
}

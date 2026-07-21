import { HardwareMidiPort } from './hardware-port.js';

export type NrpnAddress = { msb: number; lsb: number };

export type NrpnSendOptions = {
  channel?: number;
  /** When true, omits CC99/98 if the address matches last selected (per port). */
  enableAddressCaching?: boolean;
};

export class NrpnSender {
  private lastSelected: NrpnAddress | null = null;

  constructor(private readonly port: HardwareMidiPort) {}

  send(address: NrpnAddress, value14: number, options: NrpnSendOptions = {}): void {
    const channel = options.channel ?? this.port.channel;
    const enableCaching = options.enableAddressCaching ?? true;

    const msb = address.msb & 0x7f;
    const lsb = address.lsb & 0x7f;

    const dataMsb = (value14 >> 7) & 0x7f;
    const dataLsb = value14 & 0x7f;

    const shouldSelect =
      !enableCaching ||
      this.lastSelected === null ||
      this.lastSelected.msb !== msb ||
      this.lastSelected.lsb !== lsb;

    if (shouldSelect) {
      // CC99/98 select the NRPN parameter.
      this.port.sendCc(99, msb, channel);
      this.port.sendCc(98, lsb, channel);
      this.lastSelected = { msb, lsb };
    }

    // Data Entry MSB/LSB. DeepMind uses 0..255 for many params; we send both bytes.
    this.port.sendCc(6, dataMsb, channel);
    this.port.sendCc(38, dataLsb, channel);
  }
}

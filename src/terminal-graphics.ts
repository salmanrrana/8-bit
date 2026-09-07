import { randomInt } from "node:crypto";
import { deflateSync } from "node:zlib";
import type { Fb } from "./fb.ts";
import { rgbBytes } from "./hd-render.ts";

const ESC = "\x1b";
const command = (control: string, payload = "") =>
  `${ESC}_G${control}${payload ? `;${payload}` : ""}${ESC}\\`;

/** Probe actual support: inherited TERM_PROGRAM is unreliable inside multiplexers. */
export class TerminalGraphics {
  readonly queryId = randomInt(10000, 1000000000);
  supported = false;
  answered = false;
  private cellAspect = 0.5;
  private current = 0;

  query(): string {
    return (
      command(`a=q,i=${this.queryId},s=1,v=1,t=d,f=24`, "AAAA") +
      `${ESC}[16t${ESC}[c`
    );
  }
  accept(response: string): void {
    if (
      response.startsWith(`${ESC}_G`) &&
      response.includes(`i=${this.queryId};`)
    ) {
      this.supported = response.endsWith(`;OK${ESC}\\`);
      this.answered = true;
    }
    if (response.startsWith(`${ESC}[?`) && response.endsWith("c"))
      this.answered = true;
    const cell = /^6;(\d+);(\d+)t$/.exec(
      response.startsWith(`${ESC}[`) ? response.slice(2) : "",
    );
    if (cell && Number(cell[1]) > 0 && Number(cell[2]) > 0)
      this.cellAspect = Number(cell[2]) / Number(cell[1]);
  }
  encode(frame: Fb, cols: number, rows: number): string {
    const data = deflateSync(rgbBytes(frame), { level: 1 }).toString("base64");
    const ratio = frame.w / frame.h / this.cellAspect;
    const height = Math.max(1, Math.min(rows, Math.floor(cols / ratio)));
    const width = Math.max(1, Math.min(cols, Math.round(height * ratio)));
    const x = Math.floor((cols - width) / 2) + 1,
      y = Math.floor((rows - height) / 2) + 1;
    const next = this.current === 1 ? 2 : 1,
      id = this.queryId + next;
    const parts = [`${ESC}[?2026h${ESC}[${y};${x}H`];
    for (let offset = 0; offset < data.length; offset += 4096) {
      const more = offset + 4096 < data.length ? 1 : 0;
      const controls =
        offset === 0
          ? `a=T,f=24,o=z,s=${frame.w},v=${frame.h},i=${id},p=1,q=2,C=1,c=${width},r=${height},z=1,m=${more}`
          : `m=${more},q=2`;
      parts.push(command(controls, data.slice(offset, offset + 4096)));
    }
    if (this.current)
      parts.push(command(`a=d,d=I,i=${this.queryId + this.current},q=2`));
    this.current = next;
    parts.push(`${ESC}[?2026l`);
    return parts.join("");
  }
  clear(): string {
    this.current = 0;
    return (
      command(`a=d,d=I,i=${this.queryId + 1},q=2`) +
      command(`a=d,d=I,i=${this.queryId + 2},q=2`) +
      `${ESC}[?2026l`
    );
  }
}

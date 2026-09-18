import { Injectable } from "@nestjs/common";

/** Abstract class so it doubles as the DI token; tests provide a fixed clock. */
export abstract class Clock {
  abstract now(): Date;
}

@Injectable()
export class SystemClock extends Clock {
  override now(): Date {
    return new Date();
  }
}

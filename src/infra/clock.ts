export interface Clock {
  now: () => Date;
}
export const systemClock: Clock = { now: () => new Date() };
export const fixedClock = (at: Date): Clock => ({ now: () => at });

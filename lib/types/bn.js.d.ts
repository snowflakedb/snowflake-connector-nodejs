declare module 'bn.js' {
  class BN {
    constructor(value: string | number | bigint | Buffer, base?: number);
    toString(base?: number): string;
    toNumber(): number;
    toBuffer(endian?: 'be' | 'le', length?: number): Buffer;
    clone(): BN;
    cmp(other: BN | string): number;
    eq(other: BN | string): boolean;
    gt(other: BN | string): boolean;
    lt(other: BN | string): boolean;
  }

  export = BN;
}

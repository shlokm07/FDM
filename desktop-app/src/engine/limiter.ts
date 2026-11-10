export class TokenBucketLimiter {
  private tokens: number = 0;
  private lastRefill: number = Date.now();

  constructor(private bytesPerSecond: number = 0) {
    this.tokens = bytesPerSecond;
  }

  public setLimit(bytesPerSecond: number): void {
    this.bytesPerSecond = Math.max(0, bytesPerSecond);
    this.tokens = this.bytesPerSecond;
    this.lastRefill = Date.now();
  }

  public getLimit(): number {
    return this.bytesPerSecond;
  }

  /**
   * Consume tokens or delay if limit exceeded
   */
  public async consume(bytes: number): Promise<void> {
    if (this.bytesPerSecond <= 0) return; // Unlimited

    this.refill();

    if (this.tokens >= bytes) {
      this.tokens -= bytes;
      return;
    }

    const needed = bytes - this.tokens;
    const waitTimeMs = Math.ceil((needed / this.bytesPerSecond) * 1000);

    return new Promise((resolve) => {
      setTimeout(() => {
        this.refill();
        this.tokens = Math.max(0, this.tokens - bytes);
        resolve();
      }, waitTimeMs);
    });
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    if (elapsedSec > 0) {
      this.tokens = Math.min(
        this.bytesPerSecond * 2,
        this.tokens + elapsedSec * this.bytesPerSecond
      );
      this.lastRefill = now;
    }
  }
}


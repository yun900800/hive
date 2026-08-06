/**
 * Money value object — integer cents to avoid floating point errors.
 * Shared Kernel (SK) between Billing and Membership contexts.
 */
export type Currency = "CNY" | "USD";

export class Money {
  private constructor(
    readonly cents: number,
    readonly currency: Currency = "CNY"
  ) {}

  static of(cents: number, currency: Currency = "CNY"): Money {
    if (!Number.isSafeInteger(cents)) {
      throw new Error(`Money must be a safe integer amount in cents, got ${cents}`);
    }
    return new Money(cents, currency);
  }

  /** 从元构建：Money.fromYuan(899) = ¥899.00 */
  static fromYuan(amount: number, currency: Currency = "CNY"): Money {
    const cents = Math.round(amount * 100);
    return Money.of(cents, currency);
  }

  static zero(currency: Currency = "CNY"): Money {
    return Money.of(0, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.cents + other.cents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.cents - other.cents, this.currency);
  }

  multiply(factor: number): Money {
    return Money.of(Math.round(this.cents * factor), this.currency);
  }

  isZero(): boolean {
    return this.cents === 0;
  }

  isNegative(): boolean {
    return this.cents < 0;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }

  /** 展示为字符串：8990 分 → "¥89.90" */
  format(currencySymbol = "¥"): string {
    const abs = Math.abs(this.cents);
    const yuan = Math.floor(abs / 100);
    const centsPart = abs % 100;
    const sign = this.cents < 0 ? "-" : "";
    return `${sign}${currencySymbol}${yuan}.${centsPart.toString().padStart(2, "0")}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: ${this.currency} vs ${other.currency}`
      );
    }
  }
}

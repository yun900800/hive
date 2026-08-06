/**
 * TimeSlot value object — encapsulates start/end time and overlap logic.
 * Shared Kernel (SK), used by Booking and Facility contexts.
 */
export class TimeSlot {
  private constructor(
    readonly startTime: Date,
    readonly endTime: Date
  ) {
    if (!(startTime instanceof Date) || Number.isNaN(startTime.getTime())) {
      throw new Error("TimeSlot startTime must be a valid Date");
    }
    if (!(endTime instanceof Date) || Number.isNaN(endTime.getTime())) {
      throw new Error("TimeSlot endTime must be a valid Date");
    }
    if (endTime.getTime() <= startTime.getTime()) {
      throw new Error("TimeSlot endTime must be after startTime");
    }
  }

  static of(startTime: Date, endTime: Date): TimeSlot {
    return new TimeSlot(startTime, endTime);
  }

  /** 时长（毫秒） */
  durationMs(): number {
    return this.endTime.getTime() - this.startTime.getTime();
  }

  /** 时长（小时，保留小数） */
  durationHours(): number {
    return this.durationMs() / 3_600_000;
  }

  /** 判断两个时段是否重叠（业务不变量：同一资源同一时段不能重复预订） */
  overlapsWith(other: TimeSlot): boolean {
    return (
      this.startTime.getTime() < other.endTime.getTime() &&
      other.startTime.getTime() < this.endTime.getTime()
    );
  }

  /** 时段是否在某个时刻之后开始 */
  isBefore(moment: Date): boolean {
    return this.startTime.getTime() < moment.getTime();
  }

  equals(other: TimeSlot): boolean {
    return (
      this.startTime.getTime() === other.startTime.getTime() &&
      this.endTime.getTime() === other.endTime.getTime()
    );
  }
}

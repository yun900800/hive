// Central schema entry — all tables must be exported from here so that
// drizzle-kit and the drizzle client can see every table.
export * from "./auth";
export * from "./outbox";
export * from "../../../modules/membership/infrastructure/db/schema";
export * from "../../../modules/facility/infrastructure/db/schema";
export * from "../../../modules/booking/infrastructure/db/schema";
export * from "../../../modules/billing/infrastructure/db/schema";
export * from "../../../modules/access/infrastructure/db/schema";
export * from "../../../modules/notification/infrastructure/db/schema";

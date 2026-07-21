import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const accountUsers = sqliteTable(
  "account_users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("account_users_email_idx").on(table.email)],
);

export const accountSessions = sqliteTable(
  "account_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => accountUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("account_sessions_token_idx").on(table.tokenHash),
    index("account_sessions_user_idx").on(table.userId),
    index("account_sessions_expires_idx").on(table.expiresAt),
  ],
);

export const savedLocations = sqliteTable(
  "saved_locations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    locationId: text("location_id").notNull(),
    nickname: text("nickname"),
    notes: text("notes"),
    preferredSpecies: text("preferred_species"),
    accessMethod: text("access_method"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("saved_locations_user_location_idx").on(table.userEmail, table.locationId),
  ],
);

export const userPreferences = sqliteTable("user_preferences", {
  userEmail: text("user_email").primaryKey(),
  preferredSpecies: text("preferred_species"),
  defaultRadiusMinutes: integer("default_radius_minutes").notNull().default(45),
  defaultAccessMethods: text("default_access_methods").notNull().default("shore"),
  units: text("units").notNull().default("imperial"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const fishingTrips = sqliteTable(
  "fishing_trips",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    locationId: text("location_id").notNull(),
    speciesId: text("species_id").notNull(),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at").notNull(),
    timezone: text("timezone").notNull().default("America/New_York"),
    anglerCount: integer("angler_count").notNull().default(1),
    effortMinutes: integer("effort_minutes").notNull(),
    catchCount: integer("catch_count").notNull(),
    zeroCatchExplicit: integer("zero_catch_explicit", { mode: "boolean" }).notNull(),
    locationDetail: text("location_detail"),
    lureOrBait: text("lure_or_bait"),
    observedWaterTemperatureC: real("observed_water_temperature_c"),
    observedClarity: text("observed_clarity"),
    notes: text("notes"),
    consentForAggregateAnalysis: integer("consent_for_aggregate_analysis", { mode: "boolean" }).notNull().default(false),
    sourceType: text("source_type").notNull().default("first-party-alpha-trip-log"),
    candidateCohort: integer("candidate_cohort", { mode: "boolean" }).notNull().default(false),
    calibrationEligible: integer("calibration_eligible", { mode: "boolean" }).notNull().default(false),
    validationEligible: integer("validation_eligible", { mode: "boolean" }).notNull().default(false),
    conditionReplayId: text("condition_replay_id"),
    conditionReplayStatus: text("condition_replay_status").notNull().default("not-requested"),
    conditionReplayPolicyVersion: text("condition_replay_policy_version"),
    conditionReplay: text("condition_replay"),
    conditionReplayedAt: text("condition_replayed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("fishing_trips_user_started_idx").on(table.userEmail, table.startedAt),
    index("fishing_trips_location_species_idx").on(table.locationId, table.speciesId),
  ],
);

export const alphaFeedback = sqliteTable(
  "alpha_feedback",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    locationId: text("location_id"),
    category: text("category").notNull(),
    pageUrl: text("page_url"),
    message: text("message").notNull(),
    contactOk: integer("contact_ok", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("new"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("alpha_feedback_user_created_idx").on(table.userEmail, table.createdAt),
    index("alpha_feedback_location_idx").on(table.locationId),
    index("alpha_feedback_status_idx").on(table.status),
  ],
);

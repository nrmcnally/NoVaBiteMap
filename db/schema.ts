import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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


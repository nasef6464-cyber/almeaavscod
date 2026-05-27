import { env } from "../config/env.js";

export const USE_PG = () => env.USE_POSTGRES && env.DATABASE_URL;
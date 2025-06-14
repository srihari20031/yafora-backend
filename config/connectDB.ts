import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error("Supabase URL and Anon Key must be set in environment variables.");
}

const supabaseDB = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

export default supabaseDB;
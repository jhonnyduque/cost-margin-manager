import { supabaseAdmin } from "../supabaseAdmin"

export async function enforceSeatLimit(companyId: string) {

  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("seat_limit_effective, current_seat_count")
    .eq("id", companyId)
    .single()

  if (error) {
    throw new Error("Failed to fetch company seats")
  }

  if (!data) {
    throw new Error("Company not found")
  }

  if (data.current_seat_count >= data.seat_limit_effective) {
    throw new Error("Seat limit exceeded")
  }
}
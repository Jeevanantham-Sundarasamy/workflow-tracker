import { supabase } from "./supabase";

/**
 * Check if a PIN is already used by any manager, supervisor, or employee.
 * Returns the name/role of the person using it, or null if available.
 */
export async function checkPinUsed(pin: string, excludeType?: "supervisor" | "employee" | "manager", excludeName?: string): Promise<string | null> {
  if (!pin) return null;

  // Check manager PIN
  try {
    const { data } = await supabase.from("settings").select("value").eq("key", "admin_pin").single();
    if (data?.value === pin) {
      if (excludeType === "manager") return null;
      return "Manager";
    }
  } catch {}

  // Check supervisor PINs
  try {
    const { data } = await supabase.from("supervisors").select("name").eq("pin", pin);
    if (data && data.length > 0) {
      const match = data[0];
      if (excludeType === "supervisor" && excludeName === match.name) return null;
      return `Supervisor: ${match.name}`;
    }
  } catch {}

  // Check employee PINs
  try {
    const { data } = await supabase.from("employees").select("name").eq("pin", pin);
    if (data && data.length > 0) {
      const match = data[0];
      if (excludeType === "employee" && excludeName === match.name) return null;
      return `Employee: ${match.name}`;
    }
  } catch {}

  return null;
}

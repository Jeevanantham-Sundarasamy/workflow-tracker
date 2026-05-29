"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import type { PorterBooking, PorterSupplier, Task } from "@/lib/types";
import { PORTER_STATUSES, VEHICLE_TYPES } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { toPng } from "html-to-image";
import {
  Plus, X, Pencil, Trash2, MapPin, Phone, User,
  Calendar, Clock, Package, ChevronRight, AlertCircle,
  Truck, Weight, ExternalLink, Copy, Check, MessageCircle,
  Image as ImageIcon, Download, Settings,
} from "lucide-react";

type Nav = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
};

// ── Suppliers are loaded from the database ────────────────────────────────────

// ── Open Porter App directly ──────────────────────────────────────────────────
function openPorterWebsite() {
  const ua = navigator.userAgent;
  const isAndroid = /android/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);

  if (isAndroid) {
    // porter.in is registered as an Android App Link by the Porter app.
    // Chrome will offer "Open with Porter" — if user sets Porter as default once,
    // it opens directly with no dialog on subsequent taps.
    window.open("https://porter.in", "_blank", "noopener,noreferrer");
  } else if (isIOS) {
    // Try porter:// scheme; fall back to App Store after 2.5s if not installed
    const timer = setTimeout(() => {
      window.location.href =
        "https://apps.apple.com/in/app/porter-delivery/id1066935012";
    }, 2500);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearTimeout(timer);
    }, { once: true });
    window.location.href = "porter://home";
  } else {
    window.open("https://porter.in", "_blank", "noopener,noreferrer");
  }
}

// ── Share booking details via share sheet or custom dialog ────────────────────
// Returns true if native share was used, false if custom dialog should be shown
async function tryNativeShare(text: string): Promise<boolean> {
  const url = "https://porter.in";
  const nav = navigator as Navigator & { share?: (d: object) => Promise<void>; canShare?: (d: object) => boolean };
  if (nav.share && nav.canShare && nav.canShare({ title: "Porter Booking", text, url })) {
    try {
      await nav.share({ title: "Porter Booking", text, url });
      return true;
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return true;
    }
  }
  return false;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const statusStyles: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600 border-slate-300",
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  "In Transit": "bg-purple-50 text-purple-700 border-purple-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled: "bg-gray-100 text-gray-500 border-gray-300",
};

const vehicleIcons: Record<string, string> = {
  Bike: "🏍️",
  Scooter: "🛵",
  "3 Wheeler": "🛺",
  "4 Wheel Auto": "🚐",
  Truck: "🚚",
  Pickup: "🛻",
};

const STATUS_FLOW = ["Pending", "Confirmed", "In Transit", "Completed"] as const;

const emptyForm = {
  materials: [] as string[],
  materialInput: "",
  from_supplier_id: "",
  to_supplier_id: "",
  approx_weight: "",
  pickup_location: "",
  drop_location: "",
  vehicle_type: "" as PorterBooking["vehicle_type"] | "",
  contact: "",
  booking_date: new Date().toISOString().split("T")[0],
  booking_time: "",
  notes: "",
  amount: "",
  status: "Pending" as PorterBooking["status"],
  stops: [] as { supplier_id: string; location: string }[],
};

export default function PorterPage() {
  const { toast } = useToast();
  const { hasFullAccess, isSupervisor, isEmployee, userName, role, login, isManager, isAdmin } = useAuth();

  const [bookings, setBookings] = useState<PorterBooking[]>([]);
  const [suppliers, setSuppliers] = useState<PorterSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<PorterBooking | null>(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [historySearch, setHistorySearch] = useState("");
  const [shareText, setShareText] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [summaryBooking, setSummaryBooking] = useState<PorterBooking | null>(null);
  const [isPorterSupervisor, setIsPorterSupervisor] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<PorterSupplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: "", contact: "", address: "" });
  const [supervisorList, setSupervisorList] = useState<{ id: string; name: string; is_porter_supervisor: boolean }[]>([]);
  const [employeeList, setEmployeeList] = useState<{ id: string; name: string; is_porter_employee: boolean }[]>([]);
  const [porterAccessModalOpen, setPorterAccessModalOpen] = useState(false);
  const [porterAccessTab, setPorterAccessTab] = useState<"supervisors" | "employees">("supervisors");
  const [fromSupplierSearch, setFromSupplierSearch] = useState("");
  const [toSupplierSearch, setToSupplierSearch] = useState("");
  const [fromSupplierOpen, setFromSupplierOpen] = useState(false);
  const [toSupplierOpen, setToSupplierOpen] = useState(false);
  const fromSupplierRef = useRef<HTMLDivElement>(null);
  const toSupplierRef = useRef<HTMLDivElement>(null);
  const taskIdRef = useRef<string | null>(null);
  const requestedByRef = useRef<string | null>(null);
  const [myRequests, setMyRequests] = useState<Task[]>([]);

  // Stop state
  const [stopSearches, setStopSearches] = useState<string[]>([]);
  const [stopOpens, setStopOpens] = useState<boolean[]>([]);
  const stopRef0 = useRef<HTMLDivElement>(null);
  const stopRef1 = useRef<HTMLDivElement>(null);
  const stopRef2 = useRef<HTMLDivElement>(null);
  const stopRef3 = useRef<HTMLDivElement>(null);
  const stopRef4 = useRef<HTMLDivElement>(null);
  const stopRefs = [stopRef0, stopRef1, stopRef2, stopRef3, stopRef4];

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fromSupplierRef.current && !fromSupplierRef.current.contains(e.target as Node)) {
        setFromSupplierOpen(false);
      }
      if (toSupplierRef.current && !toSupplierRef.current.contains(e.target as Node)) {
        setToSupplierOpen(false);
      }
      stopRefs.forEach((ref, i) => {
        if (ref.current && !ref.current.contains(e.target as Node)) {
          setStopOpens((o) => o.map((v, idx) => (idx === i ? false : v)));
        }
      });
    };
    if (fromSupplierOpen || toSupplierOpen || stopOpens.some(Boolean)) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromSupplierOpen, toSupplierOpen, stopOpens]);

  const [isPorterEmployee, setIsPorterEmployee] = useState(false);

  // Load porter-supervisor flag for current user
  useEffect(() => {
    if (!userName || !isSupervisor) { setIsPorterSupervisor(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("supervisors").select("is_porter_supervisor").eq("name", userName).maybeSingle();
      if (!cancelled) setIsPorterSupervisor(!!(data as { is_porter_supervisor?: boolean } | null)?.is_porter_supervisor);
    })();
    return () => { cancelled = true; };
  }, [userName, isSupervisor]);

  // Load porter-employee flag for current user
  useEffect(() => {
    if (!userName || !isEmployee) { setIsPorterEmployee(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("employees").select("is_porter_employee").eq("name", userName).maybeSingle();
      if (!cancelled) setIsPorterEmployee(!!(data as { is_porter_employee?: boolean } | null)?.is_porter_employee);
    })();
    return () => { cancelled = true; };
  }, [userName, isEmployee]);

  const hasPorterFullAccess = hasFullAccess || isPorterSupervisor || isPorterEmployee;

  // Load suppliers from database
  const loadSuppliers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("porter_suppliers")
        .select("*")
        .order("name");

      if (error) {
        console.error("Supabase error:", error);
        const errMsg = error.message || JSON.stringify(error) || "Unknown error";
        toast(`Failed to load suppliers: ${errMsg}`, "error");
        return;
      }

      console.log("Successfully loaded suppliers:", data?.length || 0);
      setSuppliers((data as PorterSupplier[]) || []);
    } catch (err) {
      console.error("Supplier loading exception:", err);
      toast(`Error loading suppliers: ${(err as Error).message}`, "error");
    }
  }, [toast]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // Pre-fill booking form from task "Book Porter" conversion
  useEffect(() => {
    if (suppliers.length === 0) return; // wait for suppliers to load
    const raw = sessionStorage.getItem("porter_booking_prefill");
    if (!raw) return;
    sessionStorage.removeItem("porter_booking_prefill");
    try {
      const p = JSON.parse(raw) as {
        materials: string[];
        pickup: string;
        drop: string;
        vehicle: string;
        weight: string;
        supplierName: string;
        receiverName: string;
        notes: string;
        taskId?: string | null;
        requestedBy?: string | null;
      };
      taskIdRef.current = p.taskId || null;
      requestedByRef.current = p.requestedBy || null;
      const fromSupplier = suppliers.find((s) => s.name === p.supplierName);
      const toSupplier = suppliers.find((s) => s.name === p.receiverName);
      setForm({
        ...emptyForm,
        materials: p.materials,
        pickup_location: p.pickup,
        drop_location: p.drop,
        vehicle_type: (VEHICLE_TYPES.includes(p.vehicle as typeof VEHICLE_TYPES[number]) ? p.vehicle : "") as PorterBooking["vehicle_type"] | "",
        approx_weight: p.weight,
        notes: p.notes,
        from_supplier_id: fromSupplier?.id ?? "",
        to_supplier_id: toSupplier?.id ?? "",
      });
      setFromSupplierSearch(fromSupplier?.name ?? p.supplierName);
      setToSupplierSearch(toSupplier?.name ?? p.receiverName);
      setEditingBooking(null);
      setModalOpen(true);
    } catch {
      // ignore malformed prefill
    }
  }, [suppliers]);

  // Load pending porter requests (tasks) for non-porter-access users
  const loadMyRequests = useCallback(async () => {
    if (hasPorterFullAccess || !userName) { setMyRequests([]); return; }
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("created_by", userName)
      .like("task", "Porter Booking%")
      .like("location_gps", "porter_request_group:%")
      .order("created_at", { ascending: false });
    setMyRequests((data as Task[]) || []);
  }, [hasPorterFullAccess, userName]);

  useEffect(() => {
    loadMyRequests();
    const interval = setInterval(loadMyRequests, 5000);
    return () => clearInterval(interval);
  }, [loadMyRequests]);

  // Load supervisors for porter access management (managers/admins only)
  const loadSupervisors = useCallback(async () => {
    if (!hasFullAccess) return;
    const { data } = await supabase
      .from("supervisors")
      .select("id, name, is_porter_supervisor")
      .order("name");
    if (data) setSupervisorList(data as { id: string; name: string; is_porter_supervisor: boolean }[]);
  }, [hasFullAccess]);

  useEffect(() => {
    loadSupervisors();
  }, [loadSupervisors]);

  const togglePorterSupervisor = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("supervisors")
      .update({ is_porter_supervisor: !current })
      .eq("id", id);
    if (error) { toast("Failed to update access", "error"); return; }
    setSupervisorList((prev) => prev.map((s) => s.id === id ? { ...s, is_porter_supervisor: !current } : s));
    toast(!current ? "Porter access granted" : "Porter access revoked", "success");
  };

  // Load employees for porter access management
  const loadEmployees = useCallback(async () => {
    if (!hasFullAccess) return;
    const { data } = await supabase
      .from("employees")
      .select("id, name, is_porter_employee")
      .order("name");
    if (data) setEmployeeList(data as { id: string; name: string; is_porter_employee: boolean }[]);
  }, [hasFullAccess]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const togglePorterEmployee = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("employees")
      .update({ is_porter_employee: !current })
      .eq("id", id);
    if (error) { toast("Failed to update access", "error"); return; }
    setEmployeeList((prev) => prev.map((e) => e.id === id ? { ...e, is_porter_employee: !current } : e));
    toast(!current ? "Porter access granted" : "Porter access revoked", "success");
  };

  // Add or update supplier
  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim() || !supplierForm.contact.trim() || !supplierForm.address.trim()) {
      toast("All supplier fields are required", "error");
      return;
    }

    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from("porter_suppliers")
          .update(supplierForm)
          .eq("id", editingSupplier.id);
        if (error) throw error;
        toast("Supplier updated", "success");
      } else {
        const { error } = await supabase
          .from("porter_suppliers")
          .insert([{ ...supplierForm, created_by: userName || "admin" }]);
        if (error) throw error;
        toast("Supplier added", "success");
      }
      await loadSuppliers();
      setSupplierModalOpen(false);
      setEditingSupplier(null);
      setSupplierForm({ name: "", contact: "", address: "" });
    } catch (err) {
      toast(`Failed to save supplier: ${(err as Error).message}`, "error");
    }
  };

  // Delete supplier
  const handleDeleteSupplier = async (id: string) => {
    if (!confirm("Delete this supplier?")) return;
    try {
      const { error } = await supabase
        .from("porter_suppliers")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast("Supplier deleted", "success");
      await loadSuppliers();
    } catch (err) {
      toast(`Failed to delete supplier: ${(err as Error).message}`, "error");
    }
  };

  // Open supplier modal for editing
  const openEditSupplier = (s: PorterSupplier) => {
    setEditingSupplier(s);
    setSupplierForm({ name: s.name, contact: s.contact, address: s.address });
    setSupplierModalOpen(true);
  };


  const loadBookings = useCallback(async () => {
    const { data, error } = await supabase
      .from("porter_bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01") setTableError(true);
      else toast("Failed to load porter bookings", "error");
      setLoading(false);
      return;
    }

    let list = (data as PorterBooking[]) || [];
    if (!hasPorterFullAccess) {
      list = list.filter((b) =>
        b.booked_by === userName ||
        (b.notes && b.notes.includes(`[req:${userName}]`))
      );
    }
    setBookings(list);
    setLoading(false);
  }, [hasPorterFullAccess, userName, toast]);

  useEffect(() => {
    loadBookings();
    const interval = setInterval(loadBookings, 5000);
    return () => clearInterval(interval);
  }, [loadBookings]);

  const openCreate = () => {
    setEditingBooking(null);
    setForm(emptyForm);
    setFromSupplierSearch("");
    setToSupplierSearch("");
    setStopSearches([]);
    setStopOpens([]);
    setModalOpen(true);
  };

  const openEdit = (b: PorterBooking) => {
    setEditingBooking(b);
    const fromSupplier = suppliers.find((s) => s.name === b.supplier_name);
    const toSupplier = suppliers.find((s) => s.name === b.receiver_name);
    const existingStops = (b.stop_locations ?? []).filter(Boolean).map((loc) => ({ supplier_id: "", location: loc }));
    setForm({
      materials: b.materials ?? [],
      materialInput: "",
      from_supplier_id: fromSupplier?.id ?? "",
      to_supplier_id: toSupplier?.id ?? "",
      approx_weight: b.approx_weight ?? "",
      pickup_location: b.pickup_location,
      drop_location: b.drop_location,
      vehicle_type: b.vehicle_type ?? "",
      contact: b.contact ?? "",
      booking_date: b.booking_date,
      booking_time: b.booking_time ?? "",
      notes: b.notes ?? "",
      amount: b.amount ?? "",
      status: b.status,
      stops: existingStops,
    });
    setFromSupplierSearch(fromSupplier?.name ?? "");
    setToSupplierSearch(toSupplier?.name ?? "");
    setStopSearches(existingStops.map(() => ""));
    setStopOpens(existingStops.map(() => false));
    setModalOpen(true);
  };

  const addStop = () => {
    if (form.stops.length >= 5) return;
    setForm((f) => ({ ...f, stops: [...f.stops, { supplier_id: "", location: "" }] }));
    setStopSearches((s) => [...s, ""]);
    setStopOpens((o) => [...o, false]);
  };

  const removeStop = (i: number) => {
    setForm((f) => ({ ...f, stops: f.stops.filter((_, idx) => idx !== i) }));
    setStopSearches((s) => s.filter((_, idx) => idx !== i));
    setStopOpens((o) => o.filter((_, idx) => idx !== i));
  };

  const updateStopSearch = (i: number, val: string) =>
    setStopSearches((s) => s.map((x, idx) => (idx === i ? val : x)));

  const openStopDropdown = (i: number) =>
    setStopOpens((o) => o.map((x, idx) => (idx === i ? true : x)));

  const selectStopSupplier = (i: number, s: PorterSupplier) => {
    setForm((f) => ({
      ...f,
      stops: f.stops.map((st, idx) => idx === i ? { supplier_id: s.id, location: s.address } : st),
    }));
    updateStopSearch(i, s.name);
    setStopOpens((o) => o.map((x, idx) => (idx === i ? false : x)));
  };

  const updateStopLocation = (i: number, val: string) =>
    setForm((f) => ({
      ...f,
      stops: f.stops.map((st, idx) => idx === i ? { ...st, location: val } : st),
    }));

  const addMaterial = () => {
    const val = form.materialInput.trim();
    if (!val) return;
    if (form.materials.includes(val)) { toast("Material already added", "error"); return; }
    setForm((f) => ({ ...f, materials: [...f.materials, val], materialInput: "" }));
  };

  const removeMaterial = (m: string) =>
    setForm((f) => ({ ...f, materials: f.materials.filter((x) => x !== m) }));

  // Create a porter REQUEST — only tasks, no porter_bookings row, for non-porter users
  const handleCreateRequest = async () => {
    if (form.materials.length === 0 || !form.pickup_location.trim() || !form.drop_location.trim() || !form.booking_date) {
      toast("Fill at least one Material, Pickup & Drop locations", "error");
      return;
    }
    setSaving(true);

    const requestGroupId = `porter_request_group:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fromSupplier = suppliers.find((s) => s.id === form.from_supplier_id);
    const toSupplier = suppliers.find((s) => s.id === form.to_supplier_id);

    const taskDescription = [
      "Porter Booking",
      form.materials.length > 0 ? `Materials: ${form.materials.join(", ")}` : null,
      `From: ${form.pickup_location.trim()}`,
      ...form.stops.map((s) => s.location.trim()).filter(Boolean).map((loc, i) => `Stop ${i + 1}: ${loc}`),
      `To: ${form.drop_location.trim()}`,
      form.vehicle_type ? `Vehicle: ${form.vehicle_type}` : null,
    ].filter(Boolean).join(" | ");

    const followUp = [
      form.notes.trim() || null,
      form.approx_weight.trim() ? `Weight: ${form.approx_weight.trim()}` : null,
      fromSupplier ? `Supplier: ${fromSupplier.name}` : null,
      toSupplier ? `Receiver: ${toSupplier.name}` : null,
      form.amount.trim() ? `Amount: ₹${form.amount.trim()}` : null,
      form.booking_time ? `Time: ${form.booking_time}` : null,
    ].filter(Boolean).join(" | ") || null;

    let supervisorName = userName || "Unknown";
    if (isEmployee && userName) {
      const { data: empData } = await supabase.from("employees").select("supervisor_names").eq("name", userName).maybeSingle();
      const supNames = (empData as { supervisor_names?: string[] | null } | null)?.supervisor_names;
      if (supNames && supNames.length > 0) supervisorName = supNames[0];
    }

    const [{ data: porterSups }, { data: porterEmps }] = await Promise.all([
      supabase.from("supervisors").select("name").eq("is_porter_supervisor", true),
      supabase.from("employees").select("name").eq("is_porter_employee", true),
    ]);

    const persons: { name: string; type: "supervisor" | "employee" }[] = [
      ...(porterSups || []).map((s: { name: string }) => ({ name: s.name, type: "supervisor" as const })),
      ...(porterEmps || []).map((e: { name: string }) => ({ name: e.name, type: "employee" as const })),
    ];

    if (persons.length === 0) {
      toast("No porter access person found. Ask your manager to assign porter access.", "error");
      setSaving(false);
      return;
    }

    const tasks = persons.map(({ name, type }) => ({
      task: taskDescription,
      supervisor: supervisorName,
      priority: "Medium" as const,
      due_date: form.booking_date,
      status: "Pending" as const,
      follow_up: followUp,
      location_gps: requestGroupId,
      assigned_to: name,
      assigned_to_type: type,
      assigned_by: userName || "Unknown",
      created_by: userName || "Unknown",
    }));

    const { error } = await supabase.from("tasks").insert(tasks);
    if (error) {
      toast(`Request failed: ${error.message}`, "error");
    } else {
      toast("Porter request sent successfully", "success");
      setModalOpen(false);
      setForm({ ...emptyForm });
      setFromSupplierSearch("");
      setToSupplierSearch("");
      setStopSearches([]);
      setStopOpens([]);
      await loadMyRequests();
    }
    setSaving(false);
  };

  const autoCreatePorterTasks = async (booking: PorterBooking) => {
    try {
      // Determine supervisor name for the tasks
      let supervisorName = userName || "Admin";
      if (isEmployee && userName) {
        const { data: empData } = await supabase
          .from("employees")
          .select("supervisor_names")
          .eq("name", userName)
          .maybeSingle();
        const supNames = (empData as { supervisor_names?: string[] | null } | null)?.supervisor_names;
        if (supNames && supNames.length > 0) supervisorName = supNames[0];
      }

      // Fetch all porter-access persons
      const [{ data: porterSups }, { data: porterEmps }] = await Promise.all([
        supabase.from("supervisors").select("name").eq("is_porter_supervisor", true),
        supabase.from("employees").select("name").eq("is_porter_employee", true),
      ]);

      const taskDescription = [
        `Porter Booking`,
        booking.materials.length > 0 ? `Materials: ${booking.materials.join(", ")}` : null,
        `From: ${booking.pickup_location}`,
        `To: ${booking.drop_location}`,
        booking.vehicle_type ? `Vehicle: ${booking.vehicle_type}` : null,
      ].filter(Boolean).join(" | ");

      const followUp = [
        booking.notes,
        booking.approx_weight ? `Weight: ${booking.approx_weight}` : null,
        booking.supplier_name ? `Supplier: ${booking.supplier_name}` : null,
        booking.receiver_name ? `Receiver: ${booking.receiver_name}` : null,
      ].filter(Boolean).join(" | ") || null;

      const persons: { name: string; type: "supervisor" | "employee" }[] = [
        ...(porterSups || []).map((s: { name: string }) => ({ name: s.name, type: "supervisor" as const })),
        ...(porterEmps || []).map((e: { name: string }) => ({ name: e.name, type: "employee" as const })),
      ];

      if (persons.length === 0) return;

      const tasks = persons.map(({ name, type }) => ({
        task: taskDescription,
        supervisor: supervisorName,
        priority: "Medium" as const,
        due_date: booking.booking_date,
        status: "Pending" as const,
        follow_up: followUp,
        location_gps: `porter_booking_id:${booking.id}`,
        assigned_to: name,
        assigned_to_type: type,
        assigned_by: userName || "Admin",
        created_by: userName || "Admin",
      }));

      const { error } = await supabase.from("tasks").insert(tasks);
      if (error) {
        toast(`Porter tasks creation failed: ${error.message}`, "error");
      } else {
        toast(`${tasks.length} porter task${tasks.length > 1 ? "s" : ""} created`, "success");
      }
    } catch (err) {
      console.error("autoCreatePorterTasks error:", err);
    }
  };

  const handleSave = async (asDraft = false) => {
    // Non-porter-access users create requests (tasks) instead of actual bookings
    if (!hasPorterFullAccess && !editingBooking) {
      await handleCreateRequest();
      return;
    }

    if (!asDraft) {
      if (form.materials.length === 0 || !form.pickup_location.trim() || !form.drop_location.trim() || !form.booking_date) {
        toast("Fill at least one Material, Pickup & Drop locations", "error");
        return;
      }
      const isUrl = (v: string) => /^https?:\/\//i.test(v.trim());
      if (isUrl(form.pickup_location) || isUrl(form.drop_location)) {
        toast("Enter a physical address — not a website URL or Google link", "error");
        return;
      }
    }
    setSaving(true);

    const status: PorterBooking["status"] = asDraft ? "Draft" : (form.status === "Draft" ? "Pending" : form.status);
    const fromSupplier = suppliers.find((s) => s.id === form.from_supplier_id);
    const toSupplier = suppliers.find((s) => s.id === form.to_supplier_id);
    const tId = taskIdRef.current;
    const reqBy = requestedByRef.current;
    const rawNotes = form.notes.trim() || null;
    const notesWithReq = reqBy ? `[req:${reqBy}]${rawNotes ? " " + rawNotes : ""}` : rawNotes;

    const payload = {
      materials: form.materials,
      supplier_name: fromSupplier?.name || null,
      receiver_name: toSupplier?.name || null,
      approx_weight: form.approx_weight.trim() || null,
      pickup_location: form.pickup_location.trim() || (asDraft ? "(draft)" : ""),
      drop_location: form.drop_location.trim() || (asDraft ? "(draft)" : ""),
      stop_locations: form.stops.map((s) => s.location.trim()).filter(Boolean),
      stop_supplier_names: form.stops.map((s) => suppliers.find((sup) => sup.id === s.supplier_id)?.name ?? "").filter(Boolean),
      vehicle_type: (form.vehicle_type || null) as PorterBooking["vehicle_type"] | null,
      contact: form.contact.trim() || null,
      booking_date: form.booking_date,
      booking_time: form.booking_time || null,
      notes: notesWithReq,
      amount: form.amount.trim() || null,
      status,
      booked_by: userName || "Unknown",
      booked_by_role: role || "employee",
      updated_at: new Date().toISOString(),
    };

    if (editingBooking) {
      const { error } = await supabase.from("porter_bookings").update(payload).eq("id", editingBooking.id);
      if (error) toast("Failed to update", "error");
      else { toast(asDraft ? "Draft saved" : "Booking updated", "success"); await loadBookings(); }
    } else {
      const { data: created, error } = await supabase
        .from("porter_bookings")
        .insert({ ...payload, updated_at: null })
        .select()
        .single();
      if (error) toast(`Failed to create booking: ${error.message}`, "error");
      else {
        toast(asDraft ? "Draft saved" : "Booking created", "success");
        await loadBookings();
        if (!asDraft) {
          setSummaryBooking(created as PorterBooking);
          if (tId) {
            // Booking created from a porter request task — link all tasks in the request group
            taskIdRef.current = null;
            requestedByRef.current = null;
            const { data: srcTask } = await supabase.from("tasks").select("location_gps").eq("id", tId).single();
            const groupId = (srcTask as { location_gps?: string | null } | null)?.location_gps;
            if (groupId?.startsWith("porter_request_group:")) {
              await supabase.from("tasks").update({ location_gps: `porter_booking_id:${(created as PorterBooking).id}` }).eq("location_gps", groupId);
            } else {
              await supabase.from("tasks").update({ location_gps: `porter_booking_id:${(created as PorterBooking).id}` }).eq("id", tId);
            }
          } else {
            // Direct booking by porter person — auto-create tasks for notification
            await autoCreatePorterTasks(created as PorterBooking);
          }
        }
      }
    }

    setSaving(false);
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this porter booking?")) return;
    const { error } = await supabase.from("porter_bookings").delete().eq("id", id);
    if (error) { toast("Failed to delete", "error"); return; }
    // Delete auto-created porter tasks linked to this booking
    await supabase.from("tasks").delete().eq("location_gps", `porter_booking_id:${id}`);
    setBookings((p) => p.filter((b) => b.id !== id));
    toast("Booking deleted", "success");
  };

  const handleStatusChange = async (id: string, status: PorterBooking["status"]) => {
    const { error } = await supabase.from("porter_bookings").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast("Failed to update status", "error"); return; }
    setBookings((p) => p.map((b) => b.id === id ? { ...b, status } : b));
    toast("Status updated", "success");
    // Auto-complete or cancel porter tasks linked to this booking
    if (status === "Completed" || status === "Cancelled") {
      const taskStatus = status === "Completed" ? "Done" : "Cancelled";
      const completedAt = status === "Completed" ? new Date().toISOString() : null;
      await supabase.from("tasks")
        .update({ status: taskStatus, completed_at: completedAt })
        .eq("location_gps", `porter_booking_id:${id}`);
    }
  };

  const canCreate = hasFullAccess || isSupervisor || isEmployee;

  const activeBookings = bookings.filter((b) =>
    b.status !== "Completed" && b.status !== "Cancelled"
  );

  const filtered = activeBookings.filter((b) =>
    filterStatus === "All" ? true : b.status === filterStatus
  );

  const historyBookings = bookings.filter((b) =>
    b.status === "Completed" || b.status === "Cancelled"
  ).filter((b) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (
      b.porter_id?.toLowerCase().includes(q) ||
      b.supplier_name?.toLowerCase().includes(q) ||
      b.receiver_name?.toLowerCase().includes(q) ||
      b.booked_by.toLowerCase().includes(q) ||
      b.pickup_location.toLowerCase().includes(q) ||
      b.drop_location.toLowerCase().includes(q)
    );
  });

  const handlePorterShare = async (text: string) => {
    const used = await tryNativeShare(text);
    if (!used) {
      setShareText(text);
      setShareDialogOpen(true);
    }
  };

  const CREATE_SQL = `CREATE TABLE IF NOT EXISTS porter_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_name TEXT,
  receiver_name TEXT,
  materials TEXT[] NOT NULL DEFAULT '{}',
  approx_weight TEXT,
  pickup_location TEXT NOT NULL,
  drop_location TEXT NOT NULL,
  vehicle_type TEXT,
  contact TEXT,
  booking_date DATE NOT NULL,
  booking_time TIME,
  status TEXT NOT NULL DEFAULT 'Pending',
  booked_by TEXT NOT NULL,
  booked_by_role TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
ALTER TABLE porter_bookings DISABLE ROW LEVEL SECURITY;
-- Already-created installs:
-- ALTER TABLE porter_bookings ALTER COLUMN supplier_name DROP NOT NULL;
-- UPDATE supervisors SET is_porter_supervisor = TRUE WHERE pin = '0000';
-- ALTER TABLE porter_bookings ADD COLUMN IF NOT EXISTS stop_supplier_names TEXT[] DEFAULT '{}';
-- ALTER TABLE porter_bookings ADD COLUMN IF NOT EXISTS amount TEXT;`;

  if (tableError) {
    return (
      <div className="flex flex-col min-h-screen">
        <Topbar onLoginClick={() => setPinModalOpen(true)} />
        <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="w-full">
              <h3 className="font-bold text-amber-800 mb-2">Porter Bookings table not found</h3>
              <p className="text-sm text-amber-700 mb-3">Run this SQL in your Supabase SQL editor:</p>
              <pre className="bg-white border border-amber-200 rounded-xl p-4 text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap">{CREATE_SQL}</pre>
              <p className="text-xs text-amber-600 mt-3">Refresh this page after running.</p>
            </div>
          </div>
        </div>
        <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
          onSubmit={async (pin) => { const ok = await login(pin); if (ok) setPinModalOpen(false); return ok; }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />

      <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary-600" /> Porter Booking
            </h1>
            <p className="text-sm text-gray-400">{bookings.length} total booking{bookings.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-2">
            {(isManager || isAdmin) && (
              <button onClick={() => setPorterAccessModalOpen(true)}
                className="flex items-center gap-2 text-sm font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 px-5 py-2.5 rounded-xl transition shadow-sm border border-purple-200">
                <User className="w-4 h-4" /> Porter Access
              </button>
            )}
            {hasPorterFullAccess && (
              <button onClick={() => {
                setEditingSupplier(null);
                setSupplierForm({ name: "", contact: "", address: "" });
                setSupplierModalOpen(true);
              }}
                className="flex items-center gap-2 text-sm font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 px-5 py-2.5 rounded-xl transition shadow-sm border border-primary-200">
                <Settings className="w-4 h-4" /> Manage Suppliers
              </button>
            )}
            {canCreate && (
              <button onClick={openCreate}
                className="flex items-center gap-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-5 py-2.5 rounded-xl transition shadow-sm">
                <Plus className="w-4 h-4" /> {hasPorterFullAccess ? "New Booking" : "Request Porter"}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-border rounded-2xl p-1.5 w-fit">
          <button onClick={() => setActiveTab("active")}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition ${activeTab === "active" ? "bg-primary-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
            Active Bookings
          </button>
          <button onClick={() => setActiveTab("history")}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition ${activeTab === "history" ? "bg-primary-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
            History
          </button>
        </div>

        {activeTab === "active" && (
          <>
            {/* Status Filters */}
            <div className="flex gap-1 flex-wrap bg-white border border-border rounded-2xl p-3">
              {["All", "Draft", "Pending", "Confirmed", "In Transit"].map((f) => (
                <button key={f} onClick={() => setFilterStatus(f)}
                  className={`text-xs font-bold px-3 py-2 rounded-lg transition ${filterStatus === f ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {f}
                </button>
              ))}
              <span className="text-xs text-gray-400 font-medium ml-auto self-center">
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Active Cards */}
            <div className="space-y-3">
              {loading
                ? [...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-border p-5 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                ))
                : filtered.length === 0
                  ? (
                    <div className="bg-white rounded-2xl border border-border p-16 text-center">
                      <p className="text-4xl mb-3">🚚</p>
                      <p className="text-sm text-gray-400 font-medium">No active bookings found</p>
                    </div>
                  )
                  : filtered.map((b) => (
                    <BookingCard key={b.id} booking={b}
                      canManage={hasPorterFullAccess || (b.booked_by === userName && b.status !== "Completed")}
                      canDelete={hasPorterFullAccess || (b.booked_by === userName && b.status !== "Completed")}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onStatusChange={handleStatusChange}
                      onBook={() => setSummaryBooking(b)}
                      onPorterShare={handlePorterShare} />
                  ))}
            </div>

            {/* Pending Requests (non-porter users only) */}
            {!hasPorterFullAccess && myRequests.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide px-1">Awaiting Porter</h3>
                {myRequests.map((req) => {
                  const parts = req.task.split(" | ");
                  const materials = parts.find(p => p.startsWith("Materials: "))?.replace("Materials: ", "") || "";
                  const from = parts.find(p => p.startsWith("From: "))?.replace("From: ", "") || "";
                  const to = parts.find(p => p.startsWith("To: "))?.replace("To: ", "") || "";
                  return (
                    <div key={req.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex flex-wrap gap-1">
                          {materials.split(", ").filter(Boolean).map((m) => (
                            <span key={m} className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{m}</span>
                          ))}
                        </div>
                        <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-300">Awaiting Porter</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-amber-100 text-xs text-gray-600">
                        <MapPin className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        <span className="truncate font-medium">{from}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        <span className="truncate font-medium">{to}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {req.due_date}</span>
                        <button onClick={async () => {
                          if (!confirm("Cancel this porter request?")) return;
                          await supabase.from("tasks").delete().eq("location_gps", req.location_gps!);
                          await loadMyRequests();
                          toast("Request cancelled", "success");
                        }} className="ml-auto text-[11px] font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition">
                          Cancel Request
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <>
            {/* Search / Filter */}
            <div className="bg-white border border-border rounded-2xl p-3 flex gap-3 items-center">
              <input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search by Porter ID (e.g. POR-0001), supplier, or name..."
                className="flex-1 px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
              />
              {historySearch && (
                <button onClick={() => setHistorySearch("")}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition">
                  Clear
                </button>
              )}
              <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                {historyBookings.length} record{historyBookings.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* History Cards */}
            <div className="space-y-3">
              {loading
                ? [...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-border p-5 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                ))
                : historyBookings.length === 0
                  ? (
                    <div className="bg-white rounded-2xl border border-border p-16 text-center">
                      <p className="text-4xl mb-3">📦</p>
                      <p className="text-sm text-gray-400 font-medium">
                        {historySearch ? "No bookings match your search" : "No completed or cancelled bookings yet"}
                      </p>
                    </div>
                  )
                  : historyBookings.map((b) => (
                    <BookingCard key={b.id} booking={b}
                      canManage={false}
                      canDelete={hasPorterFullAccess}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onStatusChange={handleStatusChange}
                      onBook={() => setSummaryBooking(b)}
                      onPorterShare={handlePorterShare} />
                  ))}
            </div>
          </>
        )}
      </div>

      {/* Share Dialog (desktop fallback) */}
      {shareDialogOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShareDialogOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-border">
              <h2 className="text-base font-bold text-gray-900">Open in App</h2>
              <button onClick={() => setShareDialogOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-2">
              {/* WhatsApp */}
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText + "\n\nhttps://porter.in")}`}
                target="_blank" rel="noopener noreferrer"
                onClick={() => setShareDialogOpen(false)}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-green-50 hover:bg-green-100 border border-green-200 transition">
                <span className="text-2xl">💬</span>
                <div className="text-left">
                  <div className="text-sm font-bold text-green-800">WhatsApp</div>
                  <div className="text-xs text-green-600">Send booking details</div>
                </div>
              </a>
              {/* Telegram */}
              <a href={`https://t.me/share/url?url=${encodeURIComponent("https://porter.in")}&text=${encodeURIComponent(shareText)}`}
                target="_blank" rel="noopener noreferrer"
                onClick={() => setShareDialogOpen(false)}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 transition">
                <span className="text-2xl">✈️</span>
                <div className="text-left">
                  <div className="text-sm font-bold text-blue-800">Telegram</div>
                  <div className="text-xs text-blue-600">Send booking details</div>
                </div>
              </a>
              {/* Porter Web */}
              <a href="https://porter.in" target="_blank" rel="noopener noreferrer"
                onClick={() => setShareDialogOpen(false)}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-primary-50 hover:bg-primary-100 border border-primary-200 transition">
                <span className="text-2xl">🚚</span>
                <div className="text-left">
                  <div className="text-sm font-bold text-primary-800">Porter App / Website</div>
                  <div className="text-xs text-primary-600">Open porter.in to book</div>
                </div>
              </a>
              {/* Copy Text */}
              <button onClick={() => { navigator.clipboard.writeText(shareText + "\n\nhttps://porter.in"); setShareDialogOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-border transition">
                <span className="text-2xl">📋</span>
                <div className="text-left">
                  <div className="text-sm font-bold text-gray-800">Copy to Clipboard</div>
                  <div className="text-xs text-gray-500">Paste anywhere</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Porter Access Modal */}
      {porterAccessModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setPorterAccessModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Porter Access</h2>
                <p className="text-xs text-gray-400 mt-0.5">Grant or revoke porter access for supervisors and employees.</p>
              </div>
              <button onClick={() => setPorterAccessModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
                <button onClick={() => setPorterAccessTab("supervisors")}
                  className={`flex-1 text-xs font-bold py-2 rounded-lg transition ${porterAccessTab === "supervisors" ? "bg-white text-primary-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  Supervisors ({supervisorList.length})
                </button>
                <button onClick={() => setPorterAccessTab("employees")}
                  className={`flex-1 text-xs font-bold py-2 rounded-lg transition ${porterAccessTab === "employees" ? "bg-white text-primary-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  Employees ({employeeList.length})
                </button>
              </div>

              {/* Supervisors */}
              {porterAccessTab === "supervisors" && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {supervisorList.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">No supervisors found</p>
                  ) : (
                    supervisorList.map((sv) => (
                      <div key={sv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-border">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                            <User className="w-4 h-4 text-purple-500" />
                          </div>
                          <span className="text-sm font-medium text-gray-800">{sv.name}</span>
                        </div>
                        <button onClick={() => togglePorterSupervisor(sv.id, sv.is_porter_supervisor)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${sv.is_porter_supervisor ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600" : "bg-gray-200 text-gray-500 hover:bg-primary-100 hover:text-primary-700"}`}>
                          {sv.is_porter_supervisor ? "Access Granted" : "Grant Access"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Employees */}
              {porterAccessTab === "employees" && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {employeeList.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">No employees found</p>
                  ) : (
                    employeeList.map((emp) => (
                      <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-border">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-500" />
                          </div>
                          <span className="text-sm font-medium text-gray-800">{emp.name}</span>
                        </div>
                        <button onClick={() => togglePorterEmployee(emp.id, emp.is_porter_employee)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${emp.is_porter_employee ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600" : "bg-gray-200 text-gray-500 hover:bg-primary-100 hover:text-primary-700"}`}>
                          {emp.is_porter_employee ? "Access Granted" : "Grant Access"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Supplier Management Modal */}
      {supplierModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setSupplierModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
              <h2 className="text-lg font-bold text-gray-900">
                {editingSupplier ? "Edit Supplier" : "Add Supplier"}
              </h2>
              <button onClick={() => setSupplierModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">
                  Supplier Name *
                </label>
                <input
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Enter supplier name..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">
                  Contact *
                </label>
                <input
                  value={supplierForm.contact}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, contact: e.target.value }))}
                  placeholder="Enter contact numbers..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">
                  Address *
                </label>
                <textarea
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Enter full address..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={handleSaveSupplier}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition">
                  {editingSupplier ? "Update Supplier" : "Add Supplier"}
                </button>
                <button onClick={() => setSupplierModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-gray-600 hover:bg-gray-50 text-sm font-semibold transition">
                  Cancel
                </button>
              </div>

              {!editingSupplier && (
                <>
                  <div className="pt-6 border-t border-border">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Existing Suppliers</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {suppliers.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-8">No suppliers yet</p>
                      ) : (
                        suppliers.map((s) => (
                          <div key={s.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-gray-900">{s.name}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Phone className="w-3 h-3" /> {s.contact}
                              </div>
                              <div className="text-xs text-gray-500 flex items-start gap-1 mt-1">
                                <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" /> <span className="break-words">{s.address}</span>
                              </div>
                            </div>
                            <div className="flex gap-1 ml-3">
                              <button onClick={() => openEditSupplier(s)}
                                className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:bg-primary-100 p-2 rounded-lg transition">
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleDeleteSupplier(s.id)}
                                className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:bg-red-100 p-2 rounded-lg transition">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
              <h2 className="text-lg font-bold text-gray-900">
                {editingBooking ? "Edit Booking" : "New Porter Booking"}
              </h2>
              <button onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* Materials (multi-add) */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Materials * <span className="normal-case text-gray-300 font-normal">(add one or more)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    value={form.materialInput}
                    onChange={(e) => setForm((f) => ({ ...f, materialInput: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMaterial(); } }}
                    placeholder="e.g. Steel rods, Cement bags..."
                    className="flex-1 px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                  <button type="button" onClick={addMaterial}
                    className="px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition flex-shrink-0">
                    Add
                  </button>
                </div>
                {form.materials.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.materials.map((m) => (
                      <span key={m} className="flex items-center gap-1.5 bg-primary-50 border border-primary-200 text-primary-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                        {m}
                        <button type="button" onClick={() => removeMaterial(m)}
                          className="text-primary-400 hover:text-primary-700 transition">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Weight + Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Approx Weight</label>
                  <input value={form.approx_weight}
                    onChange={(e) => setForm((f) => ({ ...f, approx_weight: e.target.value }))}
                    placeholder="e.g. 50 kg"
                    className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                    Contact Number
                  </label>
                  <input value={form.contact}
                    onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                    placeholder="+91 xxxxx xxxxx" type="tel"
                    className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                </div>
              </div>

              {/* From Supplier */}
              <div className="relative" ref={fromSupplierRef}>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-green-500" /> From</span>
                </label>
                <input
                  type="text"
                  value={fromSupplierSearch}
                  onChange={(e) => setFromSupplierSearch(e.target.value)}
                  onFocus={() => setFromSupplierOpen(true)}
                  placeholder="Search supplier..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                />
                {fromSupplierOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                    {suppliers.filter((s) => {
                      const usedElsewhere = new Set([form.to_supplier_id, ...form.stops.map(st => st.supplier_id)].filter(Boolean));
                      return !usedElsewhere.has(s.id) && s.name.toLowerCase().includes(fromSupplierSearch.toLowerCase());
                    }).length === 0 ? (
                      <div className="p-3 text-xs text-gray-400 text-center">No suppliers found</div>
                    ) : (
                      suppliers.filter((s) => {
                        const usedElsewhere = new Set([form.to_supplier_id, ...form.stops.map(st => st.supplier_id)].filter(Boolean));
                        return !usedElsewhere.has(s.id) && s.name.toLowerCase().includes(fromSupplierSearch.toLowerCase());
                      }).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              from_supplier_id: s.id,
                              pickup_location: s.address,
                            }));
                            setFromSupplierSearch(s.name);
                            setFromSupplierOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm font-medium text-gray-700 transition"
                        >
                          {s.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {form.from_supplier_id && suppliers.find((s) => s.id === form.from_supplier_id) && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                    {(() => {
                      const supplier = suppliers.find((s) => s.id === form.from_supplier_id)!;
                      return (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-green-900">{supplier.name}</div>
                          <div className="text-xs text-green-700 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {supplier.contact}
                          </div>
                          <div className="text-xs text-green-700 flex items-start gap-1">
                            <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" /> <span className="break-words">{supplier.address}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Stops */}
              {form.stops.map((stop, i) => (
                <div key={i} className="relative" ref={stopRefs[i]}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-500" /> Stop {i + 1}
                      </span>
                    </label>
                    <button type="button" onClick={() => removeStop(i)}
                      className="text-red-400 hover:text-red-600 transition p-0.5 rounded">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={stopSearches[i] ?? ""}
                    onChange={(e) => updateStopSearch(i, e.target.value)}
                    onFocus={() => openStopDropdown(i)}
                    placeholder="Search supplier..."
                    className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                  />
                  {stopOpens[i] && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                      {suppliers.filter((s) => {
                        const usedElsewhere = new Set([form.from_supplier_id, form.to_supplier_id, ...form.stops.filter((_, idx) => idx !== i).map(st => st.supplier_id)].filter(Boolean));
                        return !usedElsewhere.has(s.id) && s.name.toLowerCase().includes((stopSearches[i] ?? "").toLowerCase());
                      }).length === 0 ? (
                        <div className="p-3 text-xs text-gray-400 text-center">No suppliers found</div>
                      ) : (
                        suppliers.filter((s) => {
                          const usedElsewhere = new Set([form.from_supplier_id, form.to_supplier_id, ...form.stops.filter((_, idx) => idx !== i).map(st => st.supplier_id)].filter(Boolean));
                          return !usedElsewhere.has(s.id) && s.name.toLowerCase().includes((stopSearches[i] ?? "").toLowerCase());
                        }).map((s) => (
                          <button key={s.id} type="button"
                            onClick={() => selectStopSupplier(i, s)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm font-medium text-gray-700 transition">
                            {s.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {stop.supplier_id && suppliers.find((s) => s.id === stop.supplier_id) && (() => {
                    const sup = suppliers.find((s) => s.id === stop.supplier_id)!;
                    return (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                        <div className="text-xs font-semibold text-amber-900">{sup.name}</div>
                        <div className="text-xs text-amber-700 flex items-center gap-1"><Phone className="w-3 h-3" /> {sup.contact}</div>
                        <div className="text-xs text-amber-700 flex items-start gap-1"><MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" /><span className="break-words">{sup.address}</span></div>
                      </div>
                    );
                  })()}
                  <textarea
                    value={stop.location}
                    onChange={(e) => updateStopLocation(i, e.target.value)}
                    placeholder="Stop address..."
                    rows={2}
                    className="w-full mt-2 px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none"
                  />
                </div>
              ))}
              {form.stops.length < 5 && (
                <button type="button" onClick={addStop}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 text-sm font-semibold transition">
                  <Plus className="w-4 h-4" /> Add Stop
                </button>
              )}

              {/* To Supplier */}
              <div className="relative" ref={toSupplierRef}>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-red-500" /> To</span>
                </label>
                <input
                  type="text"
                  value={toSupplierSearch}
                  onChange={(e) => setToSupplierSearch(e.target.value)}
                  onFocus={() => setToSupplierOpen(true)}
                  placeholder="Search supplier..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                />
                {toSupplierOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                    {suppliers.filter((s) => {
                      const usedElsewhere = new Set([form.from_supplier_id, ...form.stops.map(st => st.supplier_id)].filter(Boolean));
                      return !usedElsewhere.has(s.id) && s.name.toLowerCase().includes(toSupplierSearch.toLowerCase());
                    }).length === 0 ? (
                      <div className="p-3 text-xs text-gray-400 text-center">No suppliers found</div>
                    ) : (
                      suppliers.filter((s) => {
                        const usedElsewhere = new Set([form.from_supplier_id, ...form.stops.map(st => st.supplier_id)].filter(Boolean));
                        return !usedElsewhere.has(s.id) && s.name.toLowerCase().includes(toSupplierSearch.toLowerCase());
                      }).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              to_supplier_id: s.id,
                              drop_location: s.address,
                            }));
                            setToSupplierSearch(s.name);
                            setToSupplierOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm font-medium text-gray-700 transition"
                        >
                          {s.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {form.to_supplier_id && suppliers.find((s) => s.id === form.to_supplier_id) && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    {(() => {
                      const supplier = suppliers.find((s) => s.id === form.to_supplier_id)!;
                      return (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-red-900">{supplier.name}</div>
                          <div className="text-xs text-red-700 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {supplier.contact}
                          </div>
                          <div className="text-xs text-red-700 flex items-start gap-1">
                            <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" /> <span className="break-words">{supplier.address}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Pickup Location */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-green-500" /> Pickup Address *</span>
                </label>
                <textarea value={form.pickup_location}
                  onChange={(e) => setForm((f) => ({ ...f, pickup_location: e.target.value }))}
                  placeholder="e.g. 2/205A, Dhanam Nagar, Coimbatore - 641062"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 resize-none" />
              </div>

              {/* Drop Location */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-red-500" /> Drop Address *</span>
                </label>
                <textarea value={form.drop_location}
                  onChange={(e) => setForm((f) => ({ ...f, drop_location: e.target.value }))}
                  placeholder="e.g. 45 Anna Nagar, Chennai - 600040"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 resize-none" />
              </div>

              {/* Vehicle Type */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Vehicle Type</label>
                <div className="grid grid-cols-5 gap-2">
                  {VEHICLE_TYPES.map((v) => (
                    <button key={v} type="button"
                      onClick={() => setForm((f) => ({ ...f, vehicle_type: f.vehicle_type === v ? "" : v as PorterBooking["vehicle_type"] }))}
                      className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-xs font-semibold transition ${form.vehicle_type === v
                        ? "bg-primary-50 border-primary-400 text-primary-700"
                        : "border-border text-gray-500 hover:bg-gray-50"
                        }`}>
                      <span className="text-xl">{vehicleIcons[v]}</span>
                      <span className="leading-tight text-center text-[10px]">{v}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Date *</label>
                  <input value={form.booking_date} type="date"
                    min={(() => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() || 7) + 1); return d.toLocaleDateString("en-CA"); })()}
                    onChange={(e) => setForm((f) => ({ ...f, booking_date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Time (optional)</label>
                  <input value={form.booking_time} type="time"
                    onChange={(e) => setForm((f) => ({ ...f, booking_time: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Amount (optional)</label>
                <input value={form.amount} type="text"
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="e.g. ₹500"
                  className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
              </div>

              {/* Status (edit only) */}
              {editingBooking && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Status</label>
                  <select value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PorterBooking["status"] }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                    {PORTER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Notes</label>
                <textarea value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any special instructions..."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 resize-none" />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1">
                <button onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button onClick={() => handleSave(true)} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-sm font-semibold transition">
                  {saving ? "Saving..." : "Save as Draft"}
                </button>
                <button onClick={() => handleSave(false)} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold transition">
                  {saving ? "Saving..." : editingBooking ? "Update" : "Create Booking"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary + Redirect Modal */}
      {summaryBooking && (
        <BookingSummaryModal
          booking={summaryBooking}
          onClose={() => setSummaryBooking(null)}
          onPorterShare={handlePorterShare} />
      )}

      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) setPinModalOpen(false); return ok; }} />
    </div>
  );
}

// ── Booking Card ──────────────────────────────────────────────────────────────

interface BookingCardProps {
  booking: PorterBooking;
  canManage: boolean;
  canDelete: boolean;
  onEdit: (b: PorterBooking) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: PorterBooking["status"]) => void;
  onBook: () => void;
  onPorterShare: (text: string) => void;
}

function BookingCard({ booking: b, canManage, canDelete, onEdit, onDelete, onStatusChange, onBook, onPorterShare }: BookingCardProps) {
  const currentStep = STATUS_FLOW.indexOf(b.status as typeof STATUS_FLOW[number]);
  const isDone = b.status === "Completed" || b.status === "Cancelled";
  const materials = b.materials ?? [];

  const stops = (b.stop_locations ?? []).filter(Boolean);
  const cardShareText = [
    b.porter_id ? `Booking ID: ${b.porter_id}` : null,
    materials.length > 0 ? `Materials: ${materials.join(", ")}` : null,
    b.approx_weight ? `Weight: ${b.approx_weight}` : null,
    `Pickup: ${b.pickup_location}`,
    ...stops.map((loc, i) => `Stop ${i + 1}: ${loc}`),
    `Drop: ${b.drop_location}`,
    b.vehicle_type ? `Vehicle: ${b.vehicle_type}` : null,
    b.contact ? `Contact: ${b.contact}` : null,
    `Date: ${b.booking_date}${b.booking_time ? " at " + b.booking_time : ""}`,
    b.amount ? `Amount: ${b.amount}` : null,
    b.notes ? `Notes: ${b.notes.replace(/\[(linked_to|req):[^\]]+\]\s*/g, "").trim()}` : null,
  ].filter(Boolean).join("\n");

  return (
    <div className="bg-white rounded-2xl border border-border p-4 sm:p-5 hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-xl flex-shrink-0">
            {b.vehicle_type ? vehicleIcons[b.vehicle_type] : "🚚"}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              {b.porter_id && (
                <span className="text-[11px] font-bold text-primary-700 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-full tracking-wide">
                  {b.porter_id}
                </span>
              )}
            </div>
            {materials.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {materials.map((m) => (
                  <span key={m} className="text-[11px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{m}</span>
                ))}
              </div>
            ) : (
              <h3 className="text-sm font-bold text-gray-900">Porter Booking</h3>
            )}
            {b.supplier_name && (
              <p className="text-[11px] text-gray-400 mt-0.5">{b.supplier_name}</p>
            )}
          </div>
        </div>
        <span className={`text-[11px] font-bold px-3 py-1 rounded-full border flex-shrink-0 ${statusStyles[b.status]}`}>
          {b.status}
        </span>
      </div>

      {/* Route */}
      {(b.stop_locations ?? []).filter(Boolean).length === 0 ? (
        <div className="flex items-center gap-2 mb-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-border">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-gray-700 truncate">{b.supplier_name || b.pickup_location}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-gray-700 truncate">{b.receiver_name || b.drop_location}</span>
          </div>
        </div>
      ) : (
        <div className="mb-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-border space-y-1.5">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-gray-700 truncate">{b.supplier_name || b.pickup_location}</span>
          </div>
          {(b.stop_locations ?? []).filter(Boolean).map((loc, i) => (
            <div key={i} className="flex items-center gap-1.5 pl-0.5">
              <div className="w-2.5 h-2.5 rounded-full border-2 border-amber-400 flex-shrink-0 ml-0.5" />
              <span className="text-xs text-amber-700 font-medium truncate">{(b.stop_supplier_names ?? [])[i] || ""}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-gray-700 truncate">{b.receiver_name || b.drop_location}</span>
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
        {b.approx_weight && <span className="flex items-center gap-1.5"><Weight className="w-3.5 h-3.5" /> {b.approx_weight}</span>}
        {b.vehicle_type && <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> {b.vehicle_type}</span>}
        {b.contact && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {b.contact}</span>}
        {b.amount && <span className="flex items-center gap-1.5 font-semibold text-green-700">₹ {b.amount}</span>}
        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {b.booking_date}</span>
        {b.booking_time && <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {b.booking_time}</span>}
        <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {b.booked_by}</span>
      </div>

      {b.notes && (() => { const n = b.notes.replace(/\[(linked_to|req):[^\]]+\]\s*/g, "").trim(); return n ? <div className="text-xs text-gray-400 italic bg-gray-50 rounded-xl px-3 py-2 mb-3 border border-border">{n}</div> : null; })()}

      {/* Progress stepper */}
      {!isDone && (
        <>
          <div className="flex items-center gap-0.5 mb-1">
            {STATUS_FLOW.map((step, i) => (
              <div key={step} className="flex items-center flex-1">
                <div className={`flex-1 h-1.5 rounded-full transition-all ${i <= currentStep ? "bg-primary-500" : "bg-gray-100"}`} />
                {i < STATUS_FLOW.length - 1 && (
                  <div className={`w-1.5 h-1.5 rounded-full mx-0.5 ${i < currentStep ? "bg-primary-500" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-0.5 mb-3">
            {STATUS_FLOW.map((step, i) => (
              <span key={step} className={`flex-1 text-center text-[9px] font-bold ${i <= currentStep ? "text-primary-600" : "text-gray-300"}`}>
                {step}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
        <button onClick={openPorterWebsite}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition">
          <ExternalLink className="w-3 h-3" /> Book via Porter
        </button>
        <button onClick={onBook}
          className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition">
          <MessageCircle className="w-3 h-3" /> Share Image
        </button>

        {canManage && !isDone && (
          <div className="flex gap-1 flex-wrap">
            {PORTER_STATUSES.filter((s) => s !== b.status).map((s) => {
              const c: Record<string, string> = {
                Pending: "text-amber-600 bg-amber-50 hover:bg-amber-100",
                Confirmed: "text-blue-600 bg-blue-50 hover:bg-blue-100",
                "In Transit": "text-purple-600 bg-purple-50 hover:bg-purple-100",
                Completed: "text-emerald-600 bg-emerald-50 hover:bg-emerald-100",
                Cancelled: "text-gray-500 bg-gray-100 hover:bg-gray-200",
              };
              return (
                <button key={s} onClick={() => onStatusChange(b.id, s as PorterBooking["status"])}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition ${c[s] || ""}`}>
                  {s}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 ml-auto">
          {canManage && (
            <button onClick={() => onEdit(b)}
              className="flex items-center gap-1 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition">
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(b.id)}
              className="flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Booking Summary + Redirect Modal ─────────────────────────────────────────

function BookingSummaryModal({
  booking: b,
  onClose,
  onPorterShare,
}: {
  booking: PorterBooking;
  onClose: () => void;
  onPorterShare: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "info" | "success" | "error"; msg: string } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const materials = b.materials ?? [];

  const summaryText = [
    materials.length > 0 ? `Materials: ${materials.join(", ")}` : null,
    b.approx_weight ? `Weight: ${b.approx_weight}` : null,
    `Pickup Address: ${b.pickup_location}`,
    `Drop Address: ${b.drop_location}`,
    b.vehicle_type ? `Vehicle: ${b.vehicle_type}` : null,
    b.contact ? `Contact: ${b.contact}` : null,
    `Date: ${b.booking_date}${b.booking_time ? " at " + b.booking_time : ""}`,
    b.amount ? `Amount: ${b.amount}` : null,
    b.notes ? `Notes: ${b.notes.replace(/\[(linked_to|req):[^\]]+\]\s*/g, "").trim()}` : null,
  ].filter(Boolean).join("\n");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateFile = async (): Promise<File | null> => {
    if (!cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const name = `porter-booking-${String(b.id).slice(0, 8)}.png`;
    return new File([blob], name, { type: "image/png" });
  };

  const tryNativeShareWithFile = async (file: File): Promise<boolean> => {
    const nav = navigator as Nav;
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: "Porter Booking" });
        return true;
      } catch (err) {
        const e = err as DOMException;
        if (e.name === "AbortError") return true;
        console.warn("share failed", err);
      }
    }
    return false;
  };

  const tryCopyImageToClipboard = async (file: File): Promise<boolean> => {
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": file })]);
      return true;
    } catch (err) {
      console.warn("clipboard write failed", err);
      return false;
    }
  };

  const triggerDownload = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  };

  const shareWhatsAppImage = async () => {
    setBusy(true); setStatus(null);
    try {
      const file = await generateFile();
      if (!file) throw new Error("Could not capture booking card");
      const shared = await tryNativeShareWithFile(file);
      if (shared) { setStatus({ kind: "success", msg: "Opened share sheet — pick WhatsApp." }); }
      else {
        const copiedImg = await tryCopyImageToClipboard(file);
        window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
        if (copiedImg) setStatus({ kind: "success", msg: "Image copied. In WhatsApp Web pick a chat and press Ctrl+V." });
        else { triggerDownload(file); setStatus({ kind: "info", msg: "Image downloaded — attach it in WhatsApp Web." }); }
      }
    } catch (err) {
      console.error(err);
      setStatus({ kind: "error", msg: `Could not generate image: ${(err as Error).message || "unknown error"}` });
    }
    setBusy(false);
  };

  const downloadImage = async () => {
    setBusy(true); setStatus(null);
    try {
      const file = await generateFile();
      if (!file) throw new Error("Could not capture booking card");
      triggerDownload(file);
      setStatus({ kind: "success", msg: "Image downloaded." });
    } catch (err) {
      setStatus({ kind: "error", msg: `Could not generate image: ${(err as Error).message || "unknown error"}` });
    }
    setBusy(false);
  };

  const statusColor =
    status?.kind === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status?.kind === "error" ? "bg-red-50 text-red-700 border-red-200"
        : "bg-blue-50 text-blue-700 border-blue-200";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" /> Booking Ready
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Image preview card — captured for sharing */}
          <div ref={cardRef} style={{
            background: "linear-gradient(135deg,#ffffff 0%,#f8fafc 100%)",
            borderRadius: 16, padding: 20,
            border: "1px solid #e5e7eb",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: "#2563eb", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16,
              }}>P</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Porter Booking</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>Pickup Request</div>
              </div>
              <div style={{
                marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#fff",
                background: "#10b981", padding: "4px 10px", borderRadius: 999,
              }}>{b.status}</div>
            </div>

            <div style={{ height: 4 }} />

            {materials.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                {materials.map((m) => (
                  <span key={m} style={{ background: "#dbeafe", color: "#1d4ed8", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>{m}</span>
                ))}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", rowGap: 6, fontSize: 12, lineHeight: 1.4 }}>
              {b.approx_weight && (<>
                <div style={{ color: "#6b7280", fontWeight: 600 }}>Weight</div>
                <div style={{ color: "#111827" }}>{b.approx_weight}</div>
              </>)}
              <div style={{ color: "#6b7280", fontWeight: 600 }}>Pickup</div>
              <div style={{ color: "#111827" }}>{b.pickup_location}</div>
              <div style={{ color: "#6b7280", fontWeight: 600 }}>Drop</div>
              <div style={{ color: "#111827" }}>{b.drop_location}</div>
              {b.vehicle_type && (<>
                <div style={{ color: "#6b7280", fontWeight: 600 }}>Vehicle</div>
                <div style={{ color: "#111827" }}>{b.vehicle_type}</div>
              </>)}
              {b.contact && (<>
                <div style={{ color: "#6b7280", fontWeight: 600 }}>Contact</div>
                <div style={{ color: "#111827" }}>{b.contact}</div>
              </>)}
              <div style={{ color: "#6b7280", fontWeight: 600 }}>Date</div>
              <div style={{ color: "#111827" }}>{b.booking_date}{b.booking_time ? ` at ${b.booking_time}` : ""}</div>
              {b.amount && (<>
                <div style={{ color: "#6b7280", fontWeight: 600 }}>Amount</div>
                <div style={{ color: "#16a34a", fontWeight: 700 }}>{b.amount}</div>
              </>)}
              {b.notes && (<>
                <div style={{ color: "#6b7280", fontWeight: 600 }}>Notes</div>
                <div style={{ color: "#111827" }}>{b.notes}</div>
              </>)}
            </div>
          </div>

          {status && (
            <div className={`text-xs font-medium px-3 py-2 rounded-xl border ${statusColor}`}>
              {status.msg}
            </div>
          )}

          {/* WhatsApp — image only */}
          <button disabled={busy} onClick={shareWhatsAppImage}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-bold transition shadow-sm">
            <MessageCircle className="w-4 h-4" /> {busy ? "Preparing..." : "Send Image via WhatsApp"}
          </button>

          <div className="flex gap-3">
            <button onClick={handleCopy}
              className={`flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl border text-sm font-semibold transition ${copied ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "border-border text-gray-600 hover:bg-gray-50"
                }`}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Text"}
            </button>
            <button disabled={busy} onClick={downloadImage}
              className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl border border-border text-gray-600 hover:bg-gray-50 disabled:opacity-50 text-sm font-semibold transition">
              <Download className="w-4 h-4" /> Download
            </button>
          </div>

          <button onClick={openPorterWebsite}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition shadow-sm">
            <ExternalLink className="w-4 h-4" /> Open Porter App
          </button>

          <p className="text-[11px] text-gray-400 text-center">
            <ImageIcon className="w-3 h-3 inline mr-0.5 -mt-0.5" />
            WhatsApp will receive only the image — no text bubble.
          </p>
        </div>
      </div>
    </div>
  );
}


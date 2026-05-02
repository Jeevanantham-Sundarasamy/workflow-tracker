"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import type { PorterBooking } from "@/lib/types";
import { PORTER_STATUSES, VEHICLE_TYPES } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { toPng } from "html-to-image";
import {
  Plus, X, Pencil, Trash2, MapPin, Phone, User,
  Calendar, Clock, Package, ChevronRight, AlertCircle,
  Truck, Weight, ExternalLink, Copy, Check, MessageCircle, Search,
  Image as ImageIcon, Download,
} from "lucide-react";

type Nav = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
};

// ── Supplier Directory ────────────────────────────────────────────────────────
interface SupplierEntry { name: string; contact: string; address: string; }

const SUPPLIERS: SupplierEntry[] = [
  { name: "Evergreen Traders", contact: "9894870798, 9342125622", address: "11 Ground floor, Kaleeswara Main Road, Opp. Dass Lodge Canteen, Coimbatore - 641009" },
  { name: "Pioneer Fasteners", contact: "8754282450, 8870550475", address: "104 Rr Samy Lane, Kaleewara Mill Road, Near Dass Lodge Canteen, Coimbatore - 641009" },
  { name: "Balaji Bearing", contact: "9363125732, 9600412268, 7598936205", address: "BR Complex, 97, Ranga Konar St, Beside AITUC Office, Kattoor, Ram Nagar, Coimbatore - 641009" },
  { name: "Auto tools center", contact: "8098766143, 9442637241", address: "19, Kaleeswara Mill Road, Coimbatore - 641009" },
  { name: "Khams Traders", contact: "9994280690", address: "184, Ranga Konar Street, Kattoor, Coimbatore - 641009" },
  { name: "Seth Electical", contact: "7708733964", address: "No.49, Somasundaram Mill Road, Coimbatore - 641009" },
  { name: "KB Enterprises", contact: "0422-2236708", address: "85, Somasundram Mill Road, Coimbatore - 641009" },
  { name: "Sri Dharshini Enterprices", contact: "9843023516", address: "123/10E Kasthuri Building, Dr. Nanjappa Road, Coimbatore - 641018" },
  { name: "J vision", contact: "9894607077", address: "8/2, Dhandumariamman Koil Street, Avanashi Road, Coimbatore - 641018" },
  { name: "The Coimbatore Pneumatics", contact: "9566776306, 9944243601", address: "166-168 Rangakonar Street, Kattoor, Coimbatore - 641009" },
  { name: "SSB Industrial solution", contact: "8870015036, 9994210135", address: "353-A, 404-408 Marvel Complex, Sanganoor Main Road, Ganapathy - 641006" },
  { name: "Velthan Steels", contact: "9994609695, 9025960451", address: "393/3B Nalla Thanneer Thottam, Sanganoor Road, Ganapathy - 641006" },
  { name: "SPB steels", contact: "9364501112, 9363102930", address: "66-B, Sanganoor Road, Ganapathy - 641006" },
  { name: "Renuka Metals", contact: "9443652795, 9443523204", address: "274/1-A S R Complex, Sanganoor Main Road, Ganapathy, Coimbatore - 641006" },
  { name: "Pearl metal house", contact: "9952644756", address: "285/1, Nalla Thanneer Thottam, Raja Street, Ganapathy, Coimbatore - 641006" },
  { name: "Thirumal tools and hardwares", contact: "9786837089, 9750965846", address: "1424, Bharathy Nagar Stop, Sathy Main Road, Ganapathy - 641006" },
  { name: "Lion tools and hardwares", contact: "9342968187", address: "303, Pionner Tower, Dr. Nanjappa Road, Coimbatore - 641018" },
  { name: "Velan stores", contact: "9787575793", address: "NO 11/5, Avinashi Road, Thottipalayam Pirivu, Civil Aerodrome Post, Coimbatore - 641014" },
  { name: "Suriya Hardwares", contact: "9443345427", address: "1/152, Avinashi Road, Chinniyampalayam, Coimbatore - 641048" },
  { name: "Surya Agency", contact: "9787924186, 9843024186", address: "1072, Sathy Road, Opp. Textool, Ganapathy - 641006" },
  { name: "MM and Oil Seal", contact: "7397721812", address: "295, V.R. Arcade, 1st Floor, Opp. Corporation Complex, Coimbatore - 641018" },
  { name: "Meghalai Steels", contact: "6379788411", address: "S.F.No. 10/3A Krishnarayapuram, Ganapathy - 641110" },
  { name: "Burhani engineering mart", contact: "9894248208", address: "81 Chellappan Gounder Street, Katoor, Coimbatore - 641009" },
  { name: "Premier Precision Engineering", contact: "9842259052, 9843021296", address: "Site No. 11, Indra Nagar (A.K.G), Near Lion Bus, Uppilipalayam, Coimbatore - 641015" },
  { name: "Sekar keyway", contact: "9500345127", address: "No-8-A, Kasthuribai 3rd Street, Ganapathy, Coimbatore - 641006" },
  { name: "Mech Pro Engineering", contact: "9842026002", address: "HIG-1, Avarampalayam, Shoba Nagar, Krishnarayapuram, Illango Nagar, Coimbatore - 641006" },
  { name: "S P TIG Welding", contact: "9942453330", address: "No:94 Sanganoor Road, Raja Street, Ganapathy, Coimbatore - 641006" },
  { name: "Sim tech CNC", contact: "8124618161", address: "No.9, Jaganathan Industrial Estate, Athipalayam Road, Chinnavedampatti, Coimbatore - 641049" },
  { name: "Fusion engineering", contact: "9080956145", address: "124-A, Bharathy Street, Arunachalagounder Thottam, Chinnavedampatti, Coimbatore - 641049" },
  { name: "Jaya spring", contact: "9443332074", address: "NO. 28, Padel Road, Ram Nagar, Coimbatore - 641009" },
  { name: "ACM engineering", contact: "9965590091", address: "S.F.No.49/2B1, State Bank Colony Main Road, Subramaniya Nagar, Chinnavedampatti - 641049" },
  { name: "Lucky Plastics", contact: "8870683863", address: "462-D, Maraikayar Complex, N.H. Road, Townhall, Coimbatore - 641001" },
  { name: "Veera Steels", contact: "9789167683", address: "SF.NO. 14, Athipalayam Main Road, Chinnavedampatti - 641049" },
  { name: "Sri Balamurugan Surface Coating", contact: "9842249099, 9842239099", address: "7/10D, Sri Ayyappa Industrial Estate, Keeranatham Village, Kondayampalayam Road, Saravanampatti - 641035" },
  { name: "SBV enggineering works", contact: "9952260628", address: "2/494-1, Bettathapuram Pudur, Karamadi PO, Coimbatore - 641104" },
  { name: "SVS Industry", contact: "6381603667", address: "No. 2/285-A Mylampatti, Karayamapalayam, Coimbatore - 641062" },
  { name: "OM SAI PLATERS", contact: "9443551196, 8124440527", address: "2/240, Gemini Compound, Avinashi Road, Chinniyampalayam, Coimbatore - 641062" },
  { name: "Sree metal cutting eng industries", contact: "9751044455", address: "573/1B2, Athipalayam Road, Chinnavedampatti, Coimbatore - 641049" },
  { name: "Aluminium finisher", contact: "9600674796, 9043956626", address: "13/1-3 Athipalayam Road, Chinnavedampatti - 641049" },
  { name: "Sakthi Agencies", contact: "9842548211", address: "59, 2nd Street, Ganapathy - 641006" },
  { name: "M.R.Fabricators", contact: "7010787640, 9095716194", address: "145/70 Moolai Thottam, Sakthi Main Road, Ganapathy, Coimbatore - 641006" },
  { name: "SM Steel & Tubes", contact: "9751549001, 9655649001", address: "SF No.112, 3rd Street, Kandhasamy Nagar, Udhayamapalayam, Coimbatore - 641033" },
  { name: "Covai edm tools private limited", contact: "9788885555", address: "428/05-A1, Eran Thottam, Opp. BSNL Tower, Ganapathy, Coimbatore - 641006" },
  { name: "king coats", contact: "8754772968", address: "Near Global Infra Projects Company, Manickampalayam, Kunnathurpudhur, Sarcarsamakulam, Tamil Nadu - 641107" },
  { name: "Pavithra Air products", contact: "8489910661", address: "513-A/3, Chinnavedampatti, Ganapathy, Coimbatore - 641049" },
  { name: "OM Sakthi hydralics", contact: "7904631684", address: "NA Thottam, SF No 274/1 55, Sanganoor Main Road, Ganapathy, Coimbatore - 641006" },
  { name: "Cpl laser tech", contact: "9943743623", address: "439/3B2C Senthampalayam Road, Masagoundenchettipalayam, Annur Village, Coimbatore" },
  { name: "DURGA BEARING", contact: "9363208810", address: "Chennai" },
  { name: "ANUSYA GAS AGENCIES", contact: "9994684297", address: "Vinayakar Kovil, 2/14 B-1, Opp. Karayamapalayam Road, Thanam Nagar, GEM Nagar, Mylampatti, Coimbatore - 641048" },
  { name: "DYNAMIC TRADING", contact: "9989411716", address: "5.124, Ranga Konar St, Kattoor, Anupperpalayam, Ram Nagar, Coimbatore - 641009" },
  { name: "VS ENGINEERING", contact: "8883645134", address: "7, S Street Number 5, Avarampalayam, Illango Nagar, Coimbatore - 641006" },
  { name: "SRI MAHAVISHNU HEAT TREATMENT", contact: "9994179899", address: "1435, Sathy Road, Ganapathy Housing Unit, Gopalakrishnapuram, Bharathi Nagar, Coimbatore - 641006" },
  { name: "sk tools grinding", contact: "9952650507", address: "Shop No.95,96, Sanganoor Road, Raja Street, Sridevi Nagar, Ganapathy, Coimbatore - 641006" },
  { name: "Premier plastic arts", contact: "9677795977", address: "128, Lakshmi Complex, Sathya Road, Ganapathy, Coimbatore - 641006" },
  { name: "Raman Transport", contact: "9080833969", address: "Anna Nagar, Neelambur, Coimbatore - 641062" },
  { name: "Sree Fastners", contact: "7867979936", address: "240, Chellappan Street, Kattoor, Coimbatore - 641009" },
  { name: "Pinacle Caster", contact: "9035508666", address: "Ground Floor, No. 179, Rangasamy Street, Kattoor, Coimbatore - 641603" },
  { name: "Sendka Belt And Pully", contact: "8310638451", address: "146/3, 146/3-1 Bharathi Street, Anjugam Nagar, Chinnavedampatti PO, Coimbatore - 641049" },
  { name: "Pully Center", contact: "7397794481", address: "239, Dr Nanjappa Road, Anupperpalayam, Ram Nagar, Coimbatore - 641009" },
  { name: "Misumi", contact: "8800986472", address: "Plot No-31, Electronic City, Sec-18, Udyog Vihar Phase-IV, Gurgaon" },
  { name: "SMC", contact: "9849544290", address: "P-41/3, 8th Avenue, Domestic Tariff Zone, Mahindra World City, Chengalpattu, Tamil Nadu - 603004" },
  { name: "Sun Electical", contact: "9790418811", address: "Shop No.50-1A, Sathy Road, Athipalayam Pirivu, Prashakthi Nagar, Ganapathy, Coimbatore - 641006" },
];

// ── Porter App Redirect ───────────────────────────────────────────────────────
function openPorterApp() {
  const ua = navigator.userAgent;
  const isAndroid = /android/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);

  if (isAndroid) {
    const fallbackUrl = encodeURIComponent("https://play.google.com/store/apps/details?id=in.porter.user");
    window.location.href = `intent://porter.in/#Intent;scheme=https;package=in.porter.user;S.browser_fallback_url=${fallbackUrl};end`;
  } else if (isIOS) {
    const fallback = setTimeout(() => {
      window.location.href = "https://apps.apple.com/in/app/porter-delivery/id1066935012";
    }, 1500);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") clearTimeout(fallback);
    }, { once: true });
    window.location.href = "porter://";
  } else {
    window.open("https://porter.in", "_blank", "noopener,noreferrer");
  }
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
  supplier_name: "",
  supplier_target: "From" as "From" | "To",
  receiver_name: "",
  receiver_target: "To" as "From" | "To",
  materials: [] as string[],
  materialInput: "",
  approx_weight: "",
  pickup_location: "",
  drop_location: "",
  vehicle_type: "" as PorterBooking["vehicle_type"] | "",
  contact: "",
  booking_date: new Date().toISOString().split("T")[0],
  booking_time: "",
  notes: "",
  status: "Pending" as PorterBooking["status"],
};

export default function PorterPage() {
  const { toast } = useToast();
  const { hasFullAccess, isSupervisor, isEmployee, userName, role, login } = useAuth();

  const [bookings, setBookings] = useState<PorterBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<PorterBooking | null>(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [summaryBooking, setSummaryBooking] = useState<PorterBooking | null>(null);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showReceiverDropdown, setShowReceiverDropdown] = useState(false);
  const [isPorterSupervisor, setIsPorterSupervisor] = useState(false);
  const supplierRef = useRef<HTMLDivElement>(null);
  const receiverRef = useRef<HTMLDivElement>(null);

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

  const hasPorterFullAccess = hasFullAccess || isPorterSupervisor;

  // Close supplier/receiver dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) {
        setShowSupplierDropdown(false);
      }
      if (receiverRef.current && !receiverRef.current.contains(e.target as Node)) {
        setShowReceiverDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredSuppliers = SUPPLIERS.filter((s) =>
    s.name.toLowerCase().includes(form.supplier_name.toLowerCase())
  ).slice(0, 8);

  const filteredReceivers = SUPPLIERS.filter((s) =>
    s.name.toLowerCase().includes(form.receiver_name.toLowerCase())
  ).slice(0, 8);

  const selectSupplier = (s: SupplierEntry) => {
    setForm((f) => ({
      ...f,
      supplier_name: s.name,
      contact: s.contact,
      ...(f.supplier_target === "From"
        ? { pickup_location: s.address }
        : { drop_location: s.address }),
    }));
    setShowSupplierDropdown(false);
  };

  const selectReceiver = (s: SupplierEntry) => {
    setForm((f) => ({
      ...f,
      receiver_name: s.name,
      ...(f.receiver_target === "From"
        ? { pickup_location: s.address }
        : { drop_location: s.address }),
    }));
    setShowReceiverDropdown(false);
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
    if (isEmployee && !hasFullAccess && !isSupervisor && !isPorterSupervisor) {
      list = list.filter((b) => b.booked_by === userName);
    }
    setBookings(list);
    setLoading(false);
  }, [hasFullAccess, isSupervisor, isEmployee, isPorterSupervisor, userName, toast]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const openCreate = () => {
    setEditingBooking(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (b: PorterBooking) => {
    setEditingBooking(b);
    setForm({
      supplier_name: b.supplier_name,
      supplier_target: "From",
      receiver_name: b.receiver_name ?? "",
      receiver_target: "To",
      materials: b.materials ?? [],
      materialInput: "",
      approx_weight: b.approx_weight ?? "",
      pickup_location: b.pickup_location,
      drop_location: b.drop_location,
      vehicle_type: b.vehicle_type ?? "",
      contact: b.contact ?? "",
      booking_date: b.booking_date,
      booking_time: b.booking_time ?? "",
      notes: b.notes ?? "",
      status: b.status,
    });
    setModalOpen(true);
  };

  const addMaterial = () => {
    const val = form.materialInput.trim();
    if (!val) return;
    if (form.materials.includes(val)) { toast("Material already added", "error"); return; }
    setForm((f) => ({ ...f, materials: [...f.materials, val], materialInput: "" }));
  };

  const removeMaterial = (m: string) =>
    setForm((f) => ({ ...f, materials: f.materials.filter((x) => x !== m) }));

  const handleSave = async (asDraft = false) => {
    if (!asDraft) {
      if (!form.supplier_name.trim() || form.materials.length === 0 || !form.pickup_location.trim() || !form.drop_location.trim() || !form.booking_date) {
        toast("Fill Supplier Name, at least one Material, Pickup & Drop locations", "error");
        return;
      }
      const isUrl = (v: string) => /^https?:\/\//i.test(v.trim());
      if (isUrl(form.pickup_location) || isUrl(form.drop_location)) {
        toast("Enter a physical address — not a website URL or Google link", "error");
        return;
      }
    } else {
      if (!form.supplier_name.trim()) {
        toast("Supplier name is required even for drafts", "error");
        return;
      }
    }
    setSaving(true);

    const status: PorterBooking["status"] = asDraft ? "Draft" : (form.status === "Draft" ? "Pending" : form.status);

    const payload = {
      supplier_name: form.supplier_name.trim(),
      receiver_name: form.receiver_name.trim() || null,
      materials: form.materials,
      approx_weight: form.approx_weight.trim() || null,
      pickup_location: form.pickup_location.trim() || (asDraft ? "(draft)" : ""),
      drop_location: form.drop_location.trim() || (asDraft ? "(draft)" : ""),
      vehicle_type: (form.vehicle_type || null) as PorterBooking["vehicle_type"] | null,
      contact: form.contact.trim() || null,
      booking_date: form.booking_date,
      booking_time: form.booking_time || null,
      notes: form.notes.trim() || null,
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
        if (!asDraft) setSummaryBooking(created as PorterBooking);
      }
    }

    setSaving(false);
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this porter booking?")) return;
    const { error } = await supabase.from("porter_bookings").delete().eq("id", id);
    if (error) toast("Failed to delete", "error");
    else { setBookings((p) => p.filter((b) => b.id !== id)); toast("Booking deleted", "success"); }
  };

  const handleStatusChange = async (id: string, status: PorterBooking["status"]) => {
    const { error } = await supabase.from("porter_bookings").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast("Failed to update status", "error");
    else { setBookings((p) => p.map((b) => b.id === id ? { ...b, status } : b)); toast("Status updated", "success"); }
  };

  const canCreate = hasFullAccess || isSupervisor || isEmployee;

  const filtered = bookings.filter((b) =>
    filterStatus === "All" ? b.status !== "Completed" && b.status !== "Cancelled" && b.status !== "Draft"
    : b.status === filterStatus
  );

  const CREATE_SQL = `CREATE TABLE IF NOT EXISTS porter_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_name TEXT NOT NULL,
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
-- ALTER TABLE porter_bookings ADD COLUMN IF NOT EXISTS receiver_name TEXT;`;

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
          {canCreate && (
            <button onClick={openCreate}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-5 py-2.5 rounded-xl transition shadow-sm">
              <Plus className="w-4 h-4" /> New Booking
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-1 flex-wrap bg-white border border-border rounded-2xl p-3">
          {["All", "Draft", "Pending", "Confirmed", "In Transit", "Completed", "Cancelled"].map((f) => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`text-xs font-bold px-3 py-2 rounded-lg transition ${filterStatus === f ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {f}
            </button>
          ))}
          <span className="text-xs text-gray-400 font-medium ml-auto self-center">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Cards */}
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
                <p className="text-sm text-gray-400 font-medium">No porter bookings found</p>
              </div>
            )
            : filtered.map((b) => (
              <BookingCard key={b.id} booking={b}
                canManage={hasPorterFullAccess || (b.booked_by === userName && b.status !== "Completed")}
                canDelete={hasPorterFullAccess || (b.booked_by === userName && b.status !== "Completed")}
                onEdit={openEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                onBook={() => setSummaryBooking(b)} />
            ))}
        </div>
      </div>

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

              {/* Supplier Name — searchable dropdown with From/To target */}
              <div ref={supplierRef}>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                    Supplier Name *
                  </label>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                    <span className="text-[10px] font-bold text-gray-400 px-1.5">Use as</span>
                    {(["From", "To"] as const).map((t) => (
                      <button key={t} type="button"
                        onClick={() => setForm((f) => ({ ...f, supplier_target: t }))}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition ${
                          form.supplier_target === t ? "bg-white text-primary-700 shadow-sm" : "text-gray-500"
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    value={form.supplier_name}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, supplier_name: e.target.value }));
                      setShowSupplierDropdown(true);
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                    placeholder="Search or type supplier name..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                  />
                  {showSupplierDropdown && filteredSuppliers.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto">
                      {filteredSuppliers.map((s) => (
                        <button
                          key={s.name}
                          type="button"
                          onMouseDown={() => selectSupplier(s)}
                          className="w-full text-left px-3 py-2.5 hover:bg-primary-50 transition border-b border-border last:border-0"
                        >
                          <div className="text-sm font-semibold text-gray-800">{s.name}</div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[11px] text-gray-400 flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {s.contact}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{s.address}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Auto-fill indicator */}
                {SUPPLIERS.some((s) => s.name === form.supplier_name) && (
                  <p className="text-[11px] text-primary-600 mt-1.5 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Contact & {form.supplier_target === "From" ? "pickup" : "drop"} address auto-filled
                  </p>
                )}
              </div>

              {/* Receiver — searchable dropdown with From/To target */}
              <div ref={receiverRef}>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                    Receiver
                  </label>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                    <span className="text-[10px] font-bold text-gray-400 px-1.5">Use as</span>
                    {(["From", "To"] as const).map((t) => (
                      <button key={t} type="button"
                        onClick={() => setForm((f) => ({ ...f, receiver_target: t }))}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition ${
                          form.receiver_target === t ? "bg-white text-primary-700 shadow-sm" : "text-gray-500"
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    value={form.receiver_name}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, receiver_name: e.target.value }));
                      setShowReceiverDropdown(true);
                    }}
                    onFocus={() => setShowReceiverDropdown(true)}
                    placeholder="Search or type receiver name..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                  />
                  {showReceiverDropdown && filteredReceivers.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto">
                      {filteredReceivers.map((s) => (
                        <button
                          key={s.name}
                          type="button"
                          onMouseDown={() => selectReceiver(s)}
                          className="w-full text-left px-3 py-2.5 hover:bg-primary-50 transition border-b border-border last:border-0"
                        >
                          <div className="text-sm font-semibold text-gray-800">{s.name}</div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[11px] text-gray-400 flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {s.contact}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{s.address}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {SUPPLIERS.some((s) => s.name === form.receiver_name) && (
                  <p className="text-[11px] text-primary-600 mt-1.5 flex items-center gap-1">
                    <Check className="w-3 h-3" /> {form.receiver_target === "From" ? "Pickup" : "Drop"} address auto-filled
                  </p>
                )}
              </div>

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
                      className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-xs font-semibold transition ${
                        form.vehicle_type === v
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
          onClose={() => setSummaryBooking(null)} />
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
}

function BookingCard({ booking: b, canManage, canDelete, onEdit, onDelete, onStatusChange, onBook }: BookingCardProps) {
  const currentStep = STATUS_FLOW.indexOf(b.status as typeof STATUS_FLOW[number]);
  const isDone = b.status === "Completed" || b.status === "Cancelled";
  const materials = b.materials ?? [];

  return (
    <div className="bg-white rounded-2xl border border-border p-4 sm:p-5 hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-xl flex-shrink-0">
            {b.vehicle_type ? vehicleIcons[b.vehicle_type] : "🚚"}
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{b.supplier_name}</h3>
            {b.receiver_name && (
              <p className="text-[11px] text-gray-500 mt-0.5">→ {b.receiver_name}</p>
            )}
            {materials.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {materials.map((m) => (
                  <span key={m} className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <span className={`text-[11px] font-bold px-3 py-1 rounded-full border flex-shrink-0 ${statusStyles[b.status]}`}>
          {b.status}
        </span>
      </div>

      {/* Route */}
      <div className="flex items-center gap-2 mb-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-border">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-700 truncate">{b.pickup_location}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-700 truncate">{b.drop_location}</span>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
        {b.approx_weight && <span className="flex items-center gap-1.5"><Weight className="w-3.5 h-3.5" /> {b.approx_weight}</span>}
        {b.vehicle_type && <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> {b.vehicle_type}</span>}
        {b.contact && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {b.contact}</span>}
        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {b.booking_date}</span>
        {b.booking_time && <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {b.booking_time}</span>}
        <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {b.booked_by}</span>
      </div>

      {b.notes && (
        <div className="text-xs text-gray-400 italic bg-gray-50 rounded-xl px-3 py-2 mb-3 border border-border">{b.notes}</div>
      )}

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
        <button onClick={onBook}
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
}: {
  booking: PorterBooking;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "info" | "success" | "error"; msg: string } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const materials = b.materials ?? [];

  const summaryText = [
    `Supplier: ${b.supplier_name}`,
    materials.length > 0 ? `Materials: ${materials.join(", ")}` : null,
    b.approx_weight ? `Weight: ${b.approx_weight}` : null,
    `Pickup Address: ${b.pickup_location}`,
    `Drop Address: ${b.drop_location}`,
    b.vehicle_type ? `Vehicle: ${b.vehicle_type}` : null,
    b.contact ? `Contact: ${b.contact}` : null,
    `Date: ${b.booking_date}${b.booking_time ? " at " + b.booking_time : ""}`,
    b.notes ? `Notes: ${b.notes}` : null,
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

            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{b.supplier_name}</h3>
            {b.receiver_name && (
              <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>→ {b.receiver_name}</p>
            )}
            {!b.receiver_name && <div style={{ height: 8 }} />}

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
              className={`flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl border text-sm font-semibold transition ${
                copied ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "border-border text-gray-600 hover:bg-gray-50"
              }`}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Text"}
            </button>
            <button disabled={busy} onClick={downloadImage}
              className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl border border-border text-gray-600 hover:bg-gray-50 disabled:opacity-50 text-sm font-semibold transition">
              <Download className="w-4 h-4" /> Download
            </button>
          </div>

          <button onClick={openPorterApp}
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


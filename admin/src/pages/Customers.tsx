import React, { useState, useEffect, useMemo } from "react";
import type { Booking, Customer } from "../types";
import {
  subscribeBookings,
  subscribeCustomers,
  addFirestoreDocument,
  updateFirestoreDocument,
  COLLECTIONS,
} from "../services/adminFirestoreService";
import { buildCustomerStats, EMPTY_STATS } from "../services/customerStats";
import { ErrorBanner } from "../components/Feedback";

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const dateLabel = (d: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
/** Older records stored N/A as the email when none was given. */
const emailOf = (c: Customer) => (c.email && c.email !== "N/A" ? c.email : "");

// Phone normalization utilities
export function getCanonicalPhoneDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
}

export function formatIndianPhone(input: string): string {
  const cleanDigits = getCanonicalPhoneDigits(input);
  if (cleanDigits.length === 10) {
    return `+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)}`;
  }
  return input.trim();
}

// Stored customer statuses: "Approved" (shown as Active) or "Blocked".
// Legacy "Active" still counts as active; any other value (or none) blocks
// the account, exactly as firestore.rules and the booking server do.
export const CUSTOMER_ACTIVE = "Approved";
export const CUSTOMER_BLOCKED = "Blocked";
export const isCustomerActive = (status?: string) => status === CUSTOMER_ACTIVE || status === "Active";
const statusLabel = (status?: string) => (isCustomerActive(status) ? "Active" : "Blocked");

export default function Customers() {
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Modals & Drawers State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedViewCustomer, setSelectedViewCustomer] = useState<Customer | null>(null);
  const [selectedEditCustomer, setSelectedEditCustomer] = useState<Customer | null>(null);

  // Form State for Add Customer
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>(CUSTOMER_ACTIVE);
  const [gender, setGender] = useState<string>("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  // Validation & Saving State
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<Customer | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit Form State
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editStatus, setEditStatus] = useState<string>(CUSTOMER_ACTIVE);
  const [editCity, setEditCity] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const unsubs = [subscribeCustomers(setCustomerList, setLoadError), subscribeBookings(setBookings, setLoadError)];
    return () => unsubs.forEach((u) => u());
  }, []);

  const stats = useMemo(() => buildCustomerStats(customerList, bookings), [customerList, bookings]);
  const statsOf = (c: Customer) => stats.get(c.id) ?? EMPTY_STATS;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const resetAddForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setStatus(CUSTOMER_ACTIVE);
    setGender("");
    setCity("");
    setNotes("");
    setFormError(null);
    setDuplicateWarning(null);
  };

  // Check phone duplicate as user types or on submit
  const checkDuplicate = (phoneInput: string): Customer | null => {
    const canonical = getCanonicalPhoneDigits(phoneInput);
    if (!canonical || canonical.length < 10) return null;
    return (
      customerList.find(
        (c) => getCanonicalPhoneDigits(c.phone || "") === canonical
      ) || null
    );
  };

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    setFormError(null);
    const dup = checkDuplicate(val);
    setDuplicateWarning(dup);
  };

  // Submit Handler for Add Customer
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Validation: Name
    if (!name.trim()) {
      setFormError("Please enter full customer name.");
      return;
    }

    // 2. Validation: Phone
    const canonicalDigits = getCanonicalPhoneDigits(phone);
    if (canonicalDigits.length !== 10) {
      setFormError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(canonicalDigits)) {
      setFormError("Mobile number must start with 6, 7, 8, or 9.");
      return;
    }

    // 3. Validation: Email (Optional format check)
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError("Please enter a valid email address.");
      return;
    }

    // 4. Duplicate Check
    const dup = checkDuplicate(phone);
    if (dup) {
      setDuplicateWarning(dup);
      setFormError(
        `A customer with phone number ${dup.phone} already exists (${dup.name}).`
      );
      return;
    }

    setSaving(true);

    try {
      const normalizedPhone = formatIndianPhone(phone);

      // Only what the admin entered. Booking counts and spend are derived
      // from bookings, never stored here.
      const customerPayload = {
        name: name.trim(),
        phone: normalizedPhone,
        email: email.trim(),
        status: status,
        role: "customer",
        source: "admin",
        gender: gender,
        city: city.trim(),
        notes: notes.trim(),
      };

      // 5. Database Save
      const docId = await addFirestoreDocument(
        COLLECTIONS.CUSTOMERS,
        customerPayload
      );

      if (docId) {
        showToast(`Customer ${name.trim()} added successfully!`);
        setShowAddModal(false);
        resetAddForm();
      } else {
        setFormError("Failed to save customer to database. Please try again.");
      }
    } catch (err: any) {
      console.error("Save customer error:", err);
      setFormError(err.message || "An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  // Edit Customer Submission
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditCustomer) return;

    setEditError(null);
    if (!editName.trim()) {
      setEditError("Name cannot be empty.");
      return;
    }
    if (editEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      setEditError("Please enter a valid email address.");
      return;
    }

    setSavingEdit(true);
    const ok = await updateFirestoreDocument(
      COLLECTIONS.CUSTOMERS,
      selectedEditCustomer.id,
      {
        name: editName.trim(),
        email: editEmail.trim(),
        status: editStatus,
        city: editCity.trim(),
      }
    );

    setSavingEdit(false);
    if (ok) {
      showToast("Customer profile updated successfully!");
      setSelectedEditCustomer(null);
    } else {
      setEditError("The profile was not updated. Check your connection and permissions, then try again.");
    }
  };

  // Block / Unblock Toggle Action
  const handleToggleBlock = async (c: Customer) => {
    const newStatus = isCustomerActive(c.status) ? CUSTOMER_BLOCKED : CUSTOMER_ACTIVE;
    const ok = await updateFirestoreDocument(
      COLLECTIONS.CUSTOMERS,
      c.id,
      { status: newStatus }
    );
    showToast(ok ? `Customer ${c.name} is now ${statusLabel(newStatus).toLowerCase()}` : `Could not change ${c.name}'s status. Check your connection and permissions.`);
  };

  // Open Edit Modal
  const handleOpenEdit = (c: Customer) => {
    setSelectedEditCustomer(c);
    setEditError(null);
    setEditName(c.name);
    setEditEmail(emailOf(c));
    setEditStatus(isCustomerActive(c.status) ? CUSTOMER_ACTIVE : CUSTOMER_BLOCKED);
    setEditCity(c.city || "");
  };

  const filtered = customerList.filter(
    (c) =>
      search === "" ||
      (c.name && c.name.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search)) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      (c.id && c.id.toLowerCase().includes(search.toLowerCase()))
  );

  const statusColor: Record<string, string> = {
    Active: "text-green-700 bg-green-50 border-green-200",
    Blocked: "text-[#E21B23] bg-red-50 border-red-200",
  };

  return (
    <div className="p-6 space-y-5">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl text-sm flex items-center gap-2 border border-gray-700 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-green-400"></span>
          {toastMessage}
        </div>
      )}

      {loadError && <ErrorBanner message={loadError} />}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Customers",
            value: customerList.length.toString(),
            color: "#E21B23",
          },
          {
            label: "Active",
            value: customerList
              .filter((c) => isCustomerActive(c.status))
              .length.toString(),
            color: "#10B981",
          },
          {
            label: "New This Month",
            value: customerList
              .filter((c) => {
                if (!c.createdAt) return false;
                const date =
                  typeof c.createdAt.toDate === "function"
                    ? c.createdAt.toDate()
                    : new Date(c.createdAt);
                const now = new Date();
                return (
                  date.getMonth() === now.getMonth() &&
                  date.getFullYear() === now.getFullYear()
                );
              })
              .length.toString(),
            color: "#3B82F6",
          },
          {
            label: "Blocked",
            value: customerList
              .filter((c) => !isCustomerActive(c.status))
              .length.toString(),
            color: "#F59E0B",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4"
          >
            <div className="text-[22px] font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-[11px] text-[#999] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E5E5E5]">
          <div className="relative flex-1 max-w-xs">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email..."
              className="w-full pl-9 pr-4 py-2 text-[13px] bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] placeholder-[#999]"
            />
          </div>
          <button
            onClick={() => {
              resetAddForm();
              setShowAddModal(true);
            }}
            className="ml-auto flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-white rounded-lg transition-all hover:opacity-90 active:scale-95"
            style={{ background: "#E21B23" }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Customer
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                {[
                  "Customer",
                  "Phone",
                  "Email",
                  "Bookings",
                  "Paid",
                  "Last Booking",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-[#999] text-xs">
                    No customer records found matching your search.
                  </td>
                </tr>
              ) : (
                filtered.map((c, i) => (
                  <tr
                    key={c.id || i}
                    className="table-row border-b border-[#F5F5F5] last:border-0 hover:bg-[#FDFDFD]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                          style={{ background: "#E21B23" }}
                        >
                          {(c.name || "User")
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold text-[#111]">
                            {c.name}
                          </div>
                          <div className="text-[10px] text-[#999]">{c.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#666] font-mono">
                      {c.phone}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#666]">
                      {emailOf(c) || "—"}
                    </td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-[#111] text-center">
                      {statsOf(c).total}
                    </td>
                    <td
                      className="px-4 py-3 text-[12px] font-semibold"
                      style={{ color: "#E21B23" }}
                    >
                      {rupees(statsOf(c).paid)}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#666]">
                      {dateLabel(statsOf(c).lastBookingAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          statusColor[statusLabel(c.status)]
                        }`}
                      >
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedViewCustomer(c)}
                          className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] hover:bg-[#FEF2F2] text-[#E21B23] font-medium transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] hover:bg-[#F5F5F5] text-[#444] font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleBlock(c)}
                          className={`text-[11px] px-2 py-1 rounded-md border border-[#E5E5E5] font-medium transition-colors ${
                            !isCustomerActive(c.status)
                              ? "text-green-700 hover:bg-green-50"
                              : "text-amber-700 hover:bg-amber-50"
                          }`}
                        >
                          {!isCustomerActive(c.status) ? "Unblock" : "Block"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Add Customer */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up border border-[#E5E5E5]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Add New Customer
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Create a verified customer profile for booking & fleet services.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Error & Duplicate Banner */}
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-red-600 shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="font-semibold">{formError}</p>
                  {duplicateWarning && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setSelectedViewCustomer(duplicateWarning);
                      }}
                      className="text-xs underline font-bold mt-1 text-red-800 hover:text-red-950 block"
                    >
                      View Existing Customer Profile ({duplicateWarning.id}) →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Full Name */}
                <div className="md:col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">
                    Full Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vignesh Kumar"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFormError(null);
                    }}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-red-500 focus:bg-white"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Mobile Number <span className="text-red-600">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-gray-500 font-medium">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      placeholder="90801 91679"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="w-full pl-11 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-red-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Email Address <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="customer@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setFormError(null);
                    }}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-red-500 focus:bg-white"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Customer Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-red-500 focus:bg-white"
                  >
                    <option value={CUSTOMER_ACTIVE}>Active</option>
                    <option value={CUSTOMER_BLOCKED}>Blocked</option>
                  </select>
                </div>

                {/* City */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    City / Location
                  </label>
                  <input
                    type="text"
                    placeholder="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-red-500 focus:bg-white"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-red-500 focus:bg-white"
                  >
                    <option value="">Not specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">
                    Customer Notes / Remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional notes regarding booking preferences or corporate identity..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-red-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white rounded-lg shadow-sm flex items-center gap-2 transition-all hover:opacity-95 disabled:opacity-50"
                  style={{ backgroundColor: "#E21B23" }}
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving Customer...</span>
                    </>
                  ) : (
                    <span>Save Customer</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: View Customer Detail */}
      {selectedViewCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up border border-[#E5E5E5]">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: "#E21B23" }}
                >
                  {(selectedViewCustomer.name || "U")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {selectedViewCustomer.name}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    ID: {selectedViewCustomer.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedViewCustomer(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="font-semibold text-gray-500">Mobile Phone:</span>
                <span className="font-mono font-bold text-gray-900">
                  {selectedViewCustomer.phone}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="font-semibold text-gray-500">Email:</span>
                <span>{emailOf(selectedViewCustomer) || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="font-semibold text-gray-500">Status:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor[statusLabel(selectedViewCustomer.status)]}`}>
                  {statusLabel(selectedViewCustomer.status)}
                </span>
              </div>
              {(() => {
                const st = statsOf(selectedViewCustomer);
                return (
                  <>
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span className="font-semibold text-gray-500">Bookings:</span>
                      <span className="font-bold">
                        {st.total} total • {st.completed} completed • {st.cancelled} cancelled
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span className="font-semibold text-gray-500">Paid:</span>
                      <span className="font-bold text-red-600">{rupees(st.paid)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span className="font-semibold text-gray-500">Unpaid completed trips:</span>
                      <span className="font-bold">{st.outstanding > 0 ? rupees(st.outstanding) : "—"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span className="font-semibold text-gray-500">Last Booking:</span>
                      <span>{dateLabel(st.lastBookingAt)}</span>
                    </div>
                  </>
                );
              })()}
              <div className="flex justify-between py-1">
                <span className="font-semibold text-gray-500">City / Location:</span>
                <span>{selectedViewCustomer.city || "—"}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedViewCustomer(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Customer */}
      {selectedEditCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-[#E5E5E5]">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">
                Edit Customer Profile
              </h3>
              <button
                onClick={() => setSelectedEditCustomer(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              {editError && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg font-semibold">
                  {editError}
                </div>
              )}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Mobile Number (Read-Only)
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedEditCustomer.phone}
                  className="w-full p-2.5 bg-gray-100 border border-gray-300 rounded-lg text-xs font-mono text-gray-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium"
                >
                  <option value={CUSTOMER_ACTIVE}>Active</option>
                  <option value={CUSTOMER_BLOCKED}>Blocked</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedEditCustomer(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm"
                  style={{ backgroundColor: "#E21B23" }}
                >
                  {savingEdit ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

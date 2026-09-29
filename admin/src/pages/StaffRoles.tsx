import { useState, useEffect } from "react";
import { StaffMember } from "../types";
import { roles as initialRoles } from "../config/constants";
import { subscribeStaff, setFirestoreDocument, updateFirestoreDocument, COLLECTIONS } from "../services/adminFirestoreService";

const statusStyle: Record<string, string> = {
  Active: "text-green-700 bg-green-50 border-green-200",
  Inactive: "text-gray-600 bg-gray-100 border-gray-200",
};

const roleColors: Record<string, string> = {
  "Super Admin": "#E21B23",
  "Booking Manager": "#3B82F6",
  "Finance Manager": "#10B981",
  "Fleet Coordinator": "#F59E0B",
  "Support Agent": "#8B5CF6",
};

export default function Staff() {
  const [activeTab, setActiveTab] = useState<"staff" | "roles">("staff");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [rolesList, setRolesList] = useState(initialRoles);

  const [newStaff, setNewStaff] = useState({ name: '', email: '', phone: '', role: 'Booking Manager', status: 'Active' });
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  useEffect(() => {
    const unsub = subscribeStaff(setStaffList);
    return () => unsub();
  }, []);

  const displayStaff: StaffMember[] = staffList;

  const handleToggleStaffStatus = async (s: StaffMember) => {
    const newStatus = s.status === "Active" ? "Inactive" : "Active";
    setStaffList((prev) =>
      prev.map((item) => (item.id === s.id ? { ...item, status: newStatus } : item)),
    );
    try {
      await updateFirestoreDocument(COLLECTIONS.STAFF, s.id, { status: newStatus });
    } catch (err) {
      console.warn("Error updating staff status:", err);
    }
  };

  const handleAddStaff = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newStaff.name.trim() || !newStaff.email.trim()) {
      alert("Staff Name and Email are required.");
      return;
    }
    const id = 'STAFF-' + Date.now();
    const createdStaff: StaffMember = {
      id,
      name: newStaff.name.trim(),
      email: newStaff.email.trim(),
      phone: newStaff.phone.trim(),
      role: newStaff.role,
      status: newStaff.status as "Active" | "Inactive",
      permissions: rolesList.find(r => r.name === newStaff.role)?.permissions || [],
      lastLogin: 'Never'
    };

    // Optimistically update staff list immediately
    setStaffList((prev) => [createdStaff, ...prev]);
    setShowAddModal(false);
    setNewStaff({ name: '', email: '', phone: '', role: 'Booking Manager', status: 'Active' });

    // Save to Firestore
    try {
      await setFirestoreDocument(COLLECTIONS.STAFF, id, createdStaff);
    } catch (err) {
      console.warn("Error saving staff member to Firestore:", err);
    }
  };

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    const exists = rolesList.some((r) => r.name.toLowerCase() === newRoleName.trim().toLowerCase());
    if (exists) {
      alert("A role with this name already exists.");
      return;
    }
    const newRole = {
      name: newRoleName.trim(),
      permissions: ["Dashboard", "Bookings", "Notifications"],
      color: "#8B5CF6",
    };
    setRolesList([...rolesList, newRole]);
    setNewRoleName("");
    setShowAddRoleModal(false);
    alert(`Role "${newRole.name}" created successfully!`);
  };

  const filtered = displayStaff.filter((s) =>
    search === "" ||
    (s.name && s.name.toLowerCase().includes(search.toLowerCase())) ||
    (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
    (s.role && s.role.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Staff", value: displayStaff.length, color: "#E21B23" },
          { label: "Active", value: displayStaff.filter((s: any) => s.status === "Active").length, color: "#10B981" },
          { label: "Roles Defined", value: rolesList.length, color: "#3B82F6" },
          { label: "Inactive", value: displayStaff.filter((s: any) => s.status === "Inactive").length, color: "#999" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
            <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] text-[#999] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-white rounded-xl border border-[#E5E5E5] p-1 w-fit shadow-sm">
          {[{ key: "staff", label: "Staff Members" }, { key: "roles", label: "Roles & Permissions" }].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${activeTab === t.key ? "text-white shadow-sm" : "text-[#666] hover:text-[#111]"}`}
              style={activeTab === t.key ? { background: "#E21B23" } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>


      </div>

      {/* Staff Table */}
      {activeTab === "staff" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4">
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff..."
                className="w-full pl-9 pr-4 py-2 text-[13px] bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#E21B23] placeholder-[#999]"
              />
            </div>
            <button onClick={() => setShowAddModal(true)} className="ml-auto flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer" style={{ background: "#E21B23" }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Staff Member
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                    {["Staff Member", "Role", "Phone", "Permissions", "Status", "Last Login", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-[#999] text-xs">
                        <div className="text-sm font-medium mb-2">
                          {staffList.length === 0 ? "No staff members found." : "No staff members match the search criteria."}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s, i) => (
                      <tr key={s.id || i} className="table-row border-b border-[#F5F5F5] last:border-0 hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                              style={{ background: roleColors[s.role] || "#E21B23" }}
                            >
                              {(s.name || 'Staff').split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                            </div>
                            <div>
                              <div className="text-[12px] font-semibold text-[#111]">{s.name}</div>
                              <div className="text-[10px] text-[#999]">{s.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
                            style={{ background: roleColors[s.role] || "#E21B23" }}
                          >
                            {s.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#666]">{s.phone}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(s.permissions || []).slice(0, 3).map((p, pi) => (
                              <span key={pi} className="text-[9px] font-semibold px-1.5 py-0.5 bg-[#F5F5F5] text-[#666] rounded">{p}</span>
                            ))}
                            {(s.permissions || []).length > 3 && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-[#F5F5F5] text-[#999] rounded">+{(s.permissions || []).length - 3} more</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusStyle[s.status]}`}>{s.status}</span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#666]">{s.lastLogin || "Active"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {s.role !== "Super Admin" && (
                              <button
                                onClick={() => handleToggleStaffStatus(s)}
                                className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-colors cursor-pointer ${
                                  s.status === "Active"
                                    ? "border-red-200 text-red-600 hover:bg-red-50"
                                    : "border-green-200 text-green-700 hover:bg-green-50"
                                }`}
                              >
                                {s.status === "Active" ? "Deactivate" : "Activate"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Roles & Permissions */}
      {activeTab === "roles" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-[12px] text-[#666]">Define roles and control feature access for each staff category.</p>
            <button
              onClick={() => setShowAddRoleModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-white rounded-lg hover:opacity-90 cursor-pointer"
              style={{ background: "#E21B23" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Role
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {rolesList.map((role, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-10 rounded-full" style={{ background: role.color }} />
                    <div>
                      <div className="text-[14px] font-bold text-[#111]">{role.name}</div>
                      <div className="text-[11px] text-[#999] mt-0.5">{displayStaff.filter((s: any) => s.role === role.name).length} staff member{displayStaff.filter((s: any) => s.role === role.name).length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.map((p, pi) => (
                    <span
                      key={pi}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: `${role.color}15`, color: role.color }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddRoleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">Define New Role</h3>
              <button onClick={() => setShowAddRoleModal(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Role Title *</label>
                <input
                  required
                  placeholder="e.g. Operations Coordinator"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                New roles will be assigned foundational Dashboard and Bookings access by default.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRoleModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg shadow"
                  style={{ background: "#E21B23" }}
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">Add Staff Member</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer">✕</button>
            </div>
            <div className="space-y-3">
              <input placeholder="Name *" className="w-full p-2 border rounded text-xs" required onChange={(e) => setNewStaff({...newStaff, name: e.target.value})} />
              <input placeholder="Email *" type="email" className="w-full p-2 border rounded text-xs" required onChange={(e) => setNewStaff({...newStaff, email: e.target.value})} />
              <input placeholder="Phone" type="tel" className="w-full p-2 border rounded text-xs" onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})} />
              <select className="w-full p-2 border rounded text-xs" onChange={(e) => setNewStaff({...newStaff, role: e.target.value})}>
                {rolesList.map(r => <option key={r.name}>{r.name}</option>)}
              </select>
              <select className="w-full p-2 border rounded text-xs" onChange={(e) => setNewStaff({...newStaff, status: e.target.value})}>
                <option>Active</option><option>Inactive</option>
              </select>

              <button
                type="button"
                onClick={handleAddStaff}
                className="w-full p-2.5 bg-[#E21B23] hover:bg-[#c4151c] text-white text-xs font-bold rounded-lg mt-2 cursor-pointer transition-colors shadow"
              >
                Create Staff Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

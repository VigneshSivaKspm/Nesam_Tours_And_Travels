import { useState, useEffect, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Booking, Driver, Vehicle, Customer } from "../types";
import {
  subscribeBookings,
  subscribeDrivers,
  subscribeVehicles,
  subscribeCustomers,
} from "../services/adminFirestoreService";
import {
  parseAmount,
  bookingDate,
  isPaid,
  formatINR,
} from "../utils/analytics";

const categoryColors: Record<string, string> = {
  "Airport Taxi": "#E21B23",
  "Outstation Cab": "#3B82F6",
  "One Way Taxi": "#10B981",
  "Local Rental": "#F59E0B",
  "Tour Package": "#8B5CF6",
};

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    Completed: "bg-green-50 text-green-700 border-green-200",
    Confirmed: "bg-blue-50 text-blue-700 border-blue-200",
    Ongoing: "bg-orange-50 text-orange-700 border-orange-200",
    Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Cancelled: "bg-red-50 text-[#E21B23] border-red-200",
    Assigned: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${styles[status] || "bg-gray-50 text-gray-600 border-gray-200"}`}
    >
      {status}
    </span>
  );
};

const PaymentBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    Paid: "text-green-700 bg-green-50",
    Pending: "text-yellow-700 bg-yellow-50",
    Unpaid: "text-red-700 bg-red-50",
    Refunded: "text-gray-600 bg-gray-100",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${styles[status] || "bg-gray-50 text-gray-600"}`}
    >
      {status}
    </span>
  );
};

export default function Dashboard({
  onNavigate,
}: {
  onNavigate: (page: string) => void;
}) {
  const [revenueTab, setRevenueTab] = useState("month");
  const [liveBookings, setLiveBookings] = useState<Booking[]>([]);
  const [liveDrivers, setLiveDrivers] = useState<Driver[]>([]);
  const [liveVehicles, setLiveVehicles] = useState<Vehicle[]>([]);
  const [liveCustomers, setLiveCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    const unsub1 = subscribeBookings(setLiveBookings);
    const unsub2 = subscribeDrivers(setLiveDrivers);
    const unsub3 = subscribeVehicles(setLiveVehicles);
    const unsub4 = subscribeCustomers(setLiveCustomers);
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, []);

  const activeTripsCount = liveBookings.filter(
    (b) =>
      b.status === "Ongoing" ||
      b.status === "In Progress" ||
      b.status === "Assigned",
  ).length;

  // Revenue chart — computed live from bookings for the selected window.
  const revenueData = useMemo(() => {
    const now = new Date();
    const buckets: { label: string; start: Date; end: Date }[] = [];
    if (revenueTab === "year") {
      for (let i = 11; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        buckets.push({
          label: start.toLocaleString("en-US", { month: "short" }),
          start,
          end,
        });
      }
    } else if (revenueTab === "week") {
      for (let i = 6; i >= 0; i--) {
        const start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - i,
        );
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
        buckets.push({
          label: start.toLocaleString("en-US", { weekday: "short" }),
          start,
          end,
        });
      }
    } else if (revenueTab === "today") {
      for (let h = 0; h < 24; h += 3) {
        const start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          h,
        );
        const end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          h + 3,
        );
        buckets.push({ label: `${String(h).padStart(2, "0")}:00`, start, end });
      }
    } else {
      // month — last 30 days
      for (let i = 29; i >= 0; i--) {
        const start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - i,
        );
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
        buckets.push({
          label: `${start.getDate()}/${start.getMonth() + 1}`,
          start,
          end,
        });
      }
    }
    return buckets.map((bk) => {
      const inRange = liveBookings.filter((b) => {
        const d = bookingDate(b);
        return d !== null && d >= bk.start && d < bk.end;
      });
      const total = inRange.reduce((s, b) => s + parseAmount(b.fare), 0);
      const tour = inRange
        .filter((b) =>
          (b.service || b.serviceType || "").toLowerCase().includes("tour"),
        )
        .reduce((s, b) => s + parseAmount(b.fare), 0);
      return { month: bk.label, total, booking: total - tour, tour };
    });
  }, [liveBookings, revenueTab]);

  const hasRevenue = revenueData.some((d) => d.total > 0);

  const totalRevenue = useMemo(
    () =>
      liveBookings.filter(isPaid).reduce((s, b) => s + parseAmount(b.fare), 0),
    [liveBookings],
  );

  const monthRevenue = useMemo(() => {
    const n = new Date();
    return liveBookings
      .filter((b) => {
        const d = bookingDate(b);
        return (
          d !== null &&
          d.getMonth() === n.getMonth() &&
          d.getFullYear() === n.getFullYear() &&
          isPaid(b)
        );
      })
      .reduce((s, b) => s + parseAmount(b.fare), 0);
  }, [liveBookings]);
  const availableVehiclesCount = liveVehicles.filter(
    (v) => v.status === "Available" || v.status === "Active",
  ).length;
  const availableDriversCount = liveDrivers.filter(
    (d) => d.status === "Online" || d.status === "Available",
  ).length;

  const kpiCards = [
    {
      title: "Total Bookings",
      value: liveBookings.length.toLocaleString(),
      sub: `Live synced from Firestore`,
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    },
    {
      title: "Active Trips",
      value: activeTripsCount.toString(),
      sub: `${liveDrivers.length} registered drivers`,
      live: true,
      icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
    },
    {
      title: "Total Customers",
      value: liveCustomers.length.toLocaleString(),
      sub: `Registered users`,
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    },
    {
      title: "Total Revenue",
      value: formatINR(totalRevenue),
      sub: `This month: ${formatINR(monthRevenue)}`,
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      accent: true,
    },
    {
      title: "Available Vehicles",
      value: availableVehiclesCount.toString(),
      sub: `${liveVehicles.length} registered vehicles`,
      icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
    },
    {
      title: "Available Drivers",
      value: availableDriversCount.toString(),
      sub: `${liveDrivers.length} total registered`,
      icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-[#E5E5E5] rounded-xl p-3 shadow-xl text-[12px]">
          <div className="font-semibold text-[#111] mb-2">{label}</div>
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: p.color }}
              />
              <span className="text-[#666]">{p.name}:</span>
              <span className="font-semibold text-[#111]">
                ₹{(p.value / 1000).toFixed(0)}K
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((card, i) => (
          <div
            key={i}
            className={`rounded-xl p-4 border ${card.accent ? "border-[#E21B23]/20" : "border-[#E5E5E5]"} bg-white shadow-sm hover:shadow-md transition-shadow cursor-default`}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.accent ? "" : "bg-[#FEF2F2]"}`}
                style={card.accent ? { background: "#E21B23" } : {}}
              >
                <svg
                  className={`w-[18px] h-[18px] ${card.accent ? "text-white" : "text-[#E21B23]"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  {card.icon.split(" M").map((d, idx) => (
                    <path
                      key={idx}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={idx === 0 ? d : "M" + d}
                    />
                  ))}
                </svg>
              </div>
              {card.live && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full badge-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <div className="text-[22px] font-bold text-[#111] leading-tight">
              {card.value}
            </div>
            <div className="text-[11px] font-medium text-[#111] mt-1 leading-tight">
              {card.title}
            </div>
            <div className="text-[10px] text-[#999] mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue Chart + Booking Distribution */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue Area Chart */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-bold text-[#111]">
                Revenue Overview
              </h2>
              <p className="text-[12px] text-[#999] mt-0.5">
                Monthly breakdown by service type
              </p>
            </div>
            <div className="flex gap-1 bg-[#F5F5F5] rounded-lg p-1">
              {["today", "week", "month", "year"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRevenueTab(tab)}
                  className={`px-3 py-1 rounded text-[11px] font-semibold transition-all capitalize ${
                    revenueTab === tab
                      ? "text-white shadow-sm"
                      : "text-[#666] hover:text-[#111]"
                  }`}
                  style={revenueTab === tab ? { background: "#E21B23" } : {}}
                >
                  {tab === "today"
                    ? "Today"
                    : tab === "week"
                      ? "Week"
                      : tab === "month"
                        ? "Month"
                        : "Year"}
                </button>
              ))}
            </div>
          </div>
          {!hasRevenue && (
            <div className="h-[240px] flex flex-col items-center justify-center text-center">
              <svg
                className="w-10 h-10 text-[#E5E5E5] mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p className="text-[13px] font-medium text-[#999]">
                No revenue recorded for this period
              </p>
              <p className="text-[11px] text-[#BBB] mt-0.5">
                Chart populates as bookings come in
              </p>
            </div>
          )}
          {hasRevenue && (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={revenueData}
              margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E21B23" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#E21B23" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#999" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#999" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${v / 1000}K`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                name="Total"
                stroke="#E21B23"
                strokeWidth={2.5}
                fill="url(#redGrad)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="booking"
                name="Bookings"
                stroke="#111111"
                strokeWidth={1.5}
                fill="none"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="tour"
                name="Tours"
                stroke="#888888"
                strokeWidth={1.5}
                fill="none"
                dot={false}
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>

        {/* Booking Distribution Pie */}
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
          <div className="mb-5">
            <h2 className="text-[15px] font-bold text-[#111]">Booking Types</h2>
            <p className="text-[12px] text-[#999] mt-0.5">
              Distribution by service
            </p>
          </div>
          {(() => {
            const categories = [
              "Airport Taxi",
              "Outstation Cab",
              "One Way Taxi",
              "Local Rental",
              "Tour Package",
            ];
            const catData = categories.map((cat) => ({
              name: cat,
              value: liveBookings.filter((b) =>
                (b.service || b.serviceType || "").includes(cat),
              ).length,
              color: categoryColors[cat] || "#E21B23",
            }));
            const hasCatData = catData.some((c) => c.value > 0);
            if (!hasCatData) {
              return (
                <div className="h-[220px] flex flex-col items-center justify-center text-center">
                  <svg
                    className="w-10 h-10 text-[#E5E5E5] mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
                    />
                  </svg>
                  <p className="text-[13px] font-medium text-[#999]">
                    No bookings yet
                  </p>
                </div>
              );
            }
            return (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={catData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {catData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v.toLocaleString(), ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {catData.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ background: item.color }}
                        />
                        <span className="text-[11px] text-[#666]">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#111]">
                        {item.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Status Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Pending",
            count: liveBookings.filter((b) => b.status === "Pending").length,
            color: "#F59E0B",
          },
          {
            label: "Confirmed",
            count: liveBookings.filter((b) => b.status === "Confirmed").length,
            color: "#3B82F6",
          },
          {
            label: "Ongoing",
            count: liveBookings.filter(
              (b) => b.status === "Ongoing" || b.status === "Trip Started",
            ).length,
            color: "#E21B23",
          },
          {
            label: "Completed",
            count: liveBookings.filter((b) => b.status === "Completed").length,
            color: "#10B981",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-4"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: s.color + "15" }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: s.color }}
                />
              </div>
              <div>
                <div className="text-[20px] font-bold text-[#111]">
                  {s.count.toLocaleString()}
                </div>
                <div className="text-[11px] text-[#999]">
                  {s.label} Bookings
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Bookings Table */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
          <div>
            <h2 className="text-[15px] font-bold text-[#111]">
              Recent Bookings
            </h2>
            <p className="text-[12px] text-[#999] mt-0.5">
              Latest booking activity
            </p>
          </div>
          <button
            onClick={() => onNavigate("bookings")}
            className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-[#E5E5E5] text-[#E21B23] hover:bg-[#FEF2F2] transition-colors"
          >
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                {[
                  "Booking ID",
                  "Customer",
                  "Service",
                  "Pickup → Drop",
                  "Date & Time",
                  "Driver",
                  "Fare",
                  "Payment",
                  "Status",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liveBookings.slice(0, 6).map((b, i) => (
                <tr
                  key={i}
                  className="table-row border-b border-[#F5F5F5] last:border-0"
                >
                  <td className="px-4 py-3">
                    <span
                      className="text-[12px] font-mono font-semibold"
                      style={{ color: "#E21B23" }}
                    >
                      {b.id}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-medium text-[#111]">
                    {b.customer}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#666]">
                    {b.service}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[11px] text-[#111]">{b.pickup}</div>
                    <div className="text-[11px] text-[#999]">→ {b.drop}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[11px] text-[#111]">{b.date}</div>
                    <div className="text-[11px] text-[#999]">{b.time}</div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#666]">
                    {b.driver}
                  </td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-[#111]">
                    {b.fare}
                  </td>
                  <td className="px-4 py-3">
                    <PaymentBadge status={b.payment} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-[#E5E5E5] hover:bg-[#FEF2F2] text-[#E21B23] transition-colors">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

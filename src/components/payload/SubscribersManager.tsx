/* eslint-disable no-alert */
"use client";

import { useState, useEffect } from "react";

interface Subscriber {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: "pending" | "verified" | "unsubscribed";
  createdAt: string;
  verified_at?: string;
}

interface SubscriberStats {
  total: number;
  verified: number;
  pending: number;
  unsubscribed: number;
}

export const SubscribersManager: React.FC = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<SubscriberStats>({
    total: 0,
    verified: 0,
    pending: 0,
    unsubscribed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      const response = await fetch("/api/admin/subscribers");
      const data = await response.json();

      setSubscribers(data.subscribers || []);
      setStats(data.stats || {});
    } catch (error) {
      console.error("Failed to fetch subscribers:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendTestEmail = async (subscriberId: string) => {
    try {
      const response = await fetch(`/api/admin/subscribers/${subscriberId}/test-email`, {
        method: "POST",
      });
      const result = await response.json();

      if (result.success) {
        alert("Test email sent successfully!");
      } else {
        alert("Failed to send test email");
      }
    } catch (error) {
      console.error("Failed to send test email:", error);
      alert("Failed to send test email");
    }
  };

  const exportSubscribers = () => {
    window.open("/api/admin/subscribers/export", "_blank");
  };

  const filteredSubscribers = subscribers.filter((subscriber) => {
    const matchesSearch =
      subscriber.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subscriber.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subscriber.last_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !statusFilter || subscriber.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div style={{ padding: "20px" }}>Loading subscribers...</div>;
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>Newsletter Subscribers</h1>
        <button
          onClick={exportSubscribers}
          style={{
            padding: "8px 16px",
            backgroundColor: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "15px",
          marginBottom: "25px",
        }}
      >
        <div
          style={{
            padding: "15px",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#3b82f6" }}>
            {stats.total}
          </div>
          <div style={{ fontSize: "14px", color: "#64748b" }}>Total</div>
        </div>
        <div
          style={{
            padding: "15px",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#10b981" }}>
            {stats.verified}
          </div>
          <div style={{ fontSize: "14px", color: "#64748b" }}>Verified</div>
        </div>
        <div
          style={{
            padding: "15px",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#f59e0b" }}>
            {stats.pending}
          </div>
          <div style={{ fontSize: "14px", color: "#64748b" }}>Pending</div>
        </div>
        <div
          style={{
            padding: "15px",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#ef4444" }}>
            {stats.unsubscribed}
          </div>
          <div style={{ fontSize: "14px", color: "#64748b" }}>Unsubscribed</div>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "15px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="Search subscribers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            minWidth: "250px",
          }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        >
          <option value="">All Status</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>
      </div>

      {/* Subscribers Table */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ backgroundColor: "#f8fafc" }}>
            <tr>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                Email
              </th>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                Name
              </th>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                Status
              </th>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                Subscribed
              </th>
              <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredSubscribers.map((subscriber, index) => (
              <tr
                key={subscriber.id}
                style={{
                  backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <td style={{ padding: "12px" }}>
                  <div style={{ fontWeight: "medium" }}>{subscriber.email}</div>
                </td>
                <td style={{ padding: "12px" }}>
                  {subscriber.first_name} {subscriber.last_name}
                </td>
                <td style={{ padding: "12px" }}>
                  <span
                    style={{
                      padding: "4px 8px",
                      backgroundColor:
                        subscriber.status === "verified"
                          ? "#dcfce7"
                          : subscriber.status === "pending"
                            ? "#fef3c7"
                            : "#fee2e2",
                      color:
                        subscriber.status === "verified"
                          ? "#166534"
                          : subscriber.status === "pending"
                            ? "#92400e"
                            : "#dc2626",
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}
                  >
                    {subscriber.status}
                  </span>
                </td>
                <td style={{ padding: "12px", fontSize: "14px", color: "#64748b" }}>
                  {new Date(subscriber.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: "12px" }}>
                  {subscriber.status === "verified" && (
                    <button
                      onClick={() => sendTestEmail(subscriber.id)}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#3b82f6",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Test Email
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredSubscribers.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "#64748b",
          }}
        >
          No subscribers found matching your criteria
        </div>
      )}
    </div>
  );
};

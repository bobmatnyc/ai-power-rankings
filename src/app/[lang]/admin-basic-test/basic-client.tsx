"use client";

export function BasicTestButton() {
  const handleTest = () => {
    console.log("[BasicTest] Starting API test...");

    fetch("/api/admin/db-status", {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    })
      .then((response) => {
        console.log("[BasicTest] Response Status:", response.status);
        console.log(
          "[BasicTest] Response Headers:",
          Object.fromEntries(response.headers.entries())
        );
        return response.text();
      })
      .then((text) => {
        console.log("[BasicTest] Response Body:", text);
        try {
          const json = JSON.parse(text);
          console.log("[BasicTest] Parsed JSON:", json);
          alert(`Test Complete! Status: ${json.status || "Unknown"}\n\nCheck console for details.`);
        } catch (e) {
          console.error("[BasicTest] Failed to parse JSON:", e);
          alert(`Test Complete!\n\nResponse: ${text}\n\nCheck console for details.`);
        }
      })
      .catch((error) => {
        console.error("[BasicTest] Fetch Error:", error);
        alert(`Error: ${error.message}`);
      });
  };

  return (
    <button
      type="button"
      onClick={handleTest}
      style={{
        padding: "10px 20px",
        fontSize: "16px",
        cursor: "pointer",
        backgroundColor: "#007bff",
        color: "white",
        border: "none",
        borderRadius: "4px",
        marginTop: "10px",
      }}
    >
      Test API
    </button>
  );
}

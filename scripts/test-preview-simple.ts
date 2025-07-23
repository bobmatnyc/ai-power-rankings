#!/usr/bin/env tsx

async function testPreview() {
  try {
    const response = await fetch("http://localhost:3000/api/admin/preview-rankings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        period: "2025-07",
        algorithm_version: "v6.0",
        preview_date: "2025-07-01",
        compare_with: "auto",
      }),
    });

    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text);

    if (response.ok) {
      const data = JSON.parse(text);
      console.log("Success:", data.success);
      console.log("Tools:", data.preview?.total_tools);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testPreview();

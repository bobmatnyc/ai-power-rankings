"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef, useState } from "react";

const TURNSTILE_SITE_KEY =
  process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"] || "0x4AAAAAABglXFXbgAmdRz-H";

export default function TurnstileDebugPage(): React.JSX.Element {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const turnstileRef = useRef<TurnstileInstance>(null);

  const handleSuccess = (token: string): void => {
    console.log("Turnstile success:", token);
    setToken(token);
    setSuccess("Turnstile verification successful!");
    setError("");
  };

  const handleError = (error: unknown): void => {
    console.error("Turnstile error:", error);
    setError(`Turnstile error: ${JSON.stringify(error)}`);
    setSuccess("");
    setToken("");
  };

  const handleExpire = (): void => {
    console.log("Turnstile expired");
    setToken("");
    setSuccess("");
  };

  const testAPI = async (): Promise<void> => {
    if (!token) {
      setError("No token available for API test");
      return;
    }

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "Debug",
          lastName: "Test",
          email: "debug@test.com",
          turnstileToken: token,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`API test successful: ${data.message}`);
      } else {
        setError(`API test failed: ${data.error}`);
      }
    } catch (err) {
      setError(`API test error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6">Turnstile Debug Page</h1>

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Environment Info</h2>
            <div className="bg-gray-100 p-4 rounded">
              <p>
                <strong>Site Key:</strong> {TURNSTILE_SITE_KEY}
              </p>
              <p>
                <strong>Environment:</strong> {process.env.NODE_ENV}
              </p>
              <p>
                <strong>Domain:</strong>{" "}
                {typeof window !== "undefined" ? window.location.hostname : "Server-side"}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Turnstile Widget</h2>
            <div className="flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={handleSuccess}
                onError={handleError}
                onExpire={handleExpire}
                options={{
                  theme: "light",
                  size: "normal",
                }}
              />
            </div>
          </div>

          {token && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Token</h2>
              <div className="bg-green-100 p-4 rounded">
                <p className="break-all">{token}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 p-4 rounded">
              {success}
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded">{error}</div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => turnstileRef.current?.reset()}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full"
            >
              Reset Turnstile
            </button>

            {token && (
              <button
                type="button"
                onClick={testAPI}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 w-full"
              >
                Test API with Token
              </button>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Debug Info</h2>
            <div className="bg-gray-100 p-4 rounded text-sm">
              <p>This page helps debug Turnstile integration issues.</p>
              <p>Error 600010 typically means "invalid site key" or domain mismatch.</p>
              <p>Check that the Cloudflare Turnstile dashboard allows this domain.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

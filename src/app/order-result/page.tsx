'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ApiLog } from "@/lib/types";

export default function OrderResultPage() {
  const [logs, setLogs] = useState<ApiLog[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("phonepe_api_logs");
    if (stored) {
      try {
        setLogs(JSON.parse(stored));
      } catch {
        setLogs([]);
      }
    }
  }, []);

  return (
    <>
      <h1>Order Result</h1>
      <div className="order-result-actions">
        <Link href="/shop" className="btn btn-primary">← Back to Shop</Link>
      </div>
      {logs.length === 0 ? (
        <div className="alert alert-info">No API logs available for this session.</div>
      ) : (
        <div className="api-logs-section">
          <details open>
            <summary className="btn btn-secondary toggle-logs-btn" style={{ cursor: "pointer", listStyle: "none", display: "inline-block", marginBottom: "1rem" }}>
              📋 Toggle API Logs ({logs.length} call{logs.length !== 1 ? "s" : ""})
            </summary>
            <div>
              {logs.map((log, i) => (
                <div key={i} className="log-card">
                  <div className="log-header">
                    <span className="log-step">{log.step}</span>
                    <span className="log-time">{log.timestamp}</span>
                  </div>
                  <div className="log-section">
                    <h3>📤 Request</h3>
                    <div className="log-meta">
                      <span className="log-method">{log.request.method}</span>
                      <code className="log-url">{log.request.url}</code>
                    </div>
                    <details><summary>Headers</summary><pre>{JSON.stringify(log.request.headers, null, 2)}</pre></details>
                    {log.request.body !== undefined && log.request.body !== null && (
                      <details><summary>Body</summary><pre>{JSON.stringify(log.request.body, null, 2)}</pre></details>
                    )}
                  </div>
                  <div className="log-section">
                    <h3>
                      📥 Response{" "}
                      <span className={`status-badge ${log.response.status_code === 200 ? "status-ok" : "status-err"}`}>
                        {log.response.status_code}
                      </span>
                    </h3>
                    <details><summary>Headers</summary><pre>{JSON.stringify(log.response.headers, null, 2)}</pre></details>
                    <details open><summary>Body</summary><pre>{JSON.stringify(log.response.body, null, 2)}</pre></details>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </>
  );
}

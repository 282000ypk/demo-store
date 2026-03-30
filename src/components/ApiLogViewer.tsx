'use client';

import type { ApiLog } from "@/lib/types";

interface ApiLogViewerProps {
  logs: ApiLog[];
  initiallyHidden?: boolean;
}

export default function ApiLogViewer({ logs, initiallyHidden = false }: ApiLogViewerProps) {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="api-logs-section">
      <details open={!initiallyHidden}>
        <summary className="btn btn-secondary toggle-logs-btn" style={{ cursor: "pointer", listStyle: "none", display: "inline-block", marginBottom: "1rem" }}>
          📋 Toggle API Logs ({logs.length} call{logs.length !== 1 ? "s" : ""})
        </summary>
        <div id="apiLogs">
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
                <details>
                  <summary>Headers</summary>
                  <pre>{JSON.stringify(log.request.headers, null, 2)}</pre>
                </details>
                {log.request.body !== undefined && log.request.body !== null && (
                  <details>
                    <summary>Body</summary>
                    <pre>{JSON.stringify(log.request.body, null, 2)}</pre>
                  </details>
                )}
              </div>
              <div className="log-section">
                <h3>
                  📥 Response{" "}
                  <span className={`status-badge ${log.response.status_code === 200 ? "status-ok" : "status-err"}`}>
                    {log.response.status_code}
                  </span>
                </h3>
                <details>
                  <summary>Headers</summary>
                  <pre>{JSON.stringify(log.response.headers, null, 2)}</pre>
                </details>
                <details open>
                  <summary>Body</summary>
                  <pre>{JSON.stringify(log.response.body, null, 2)}</pre>
                </details>
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

import { useState } from 'react';
import { FileText, Download, Sparkles, Loader2, Printer } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui';
import { useReports, useReport } from '../hooks/useReports';
import { usePortfolio } from '../hooks/useProjects';

function parse(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    return { executive_summary: content };
  }
}

function escapeHtml(str: string | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function downloadReportFile(report: { id: string; report_type: string; generated_at: string; content: string }) {
  const p = parse(report.content);
  const title = p.title || 'Darukaa Intelligence Report';
  const typeLabel = report.report_type.replace(/_/g, ' ').toUpperCase();
  const dateStr = new Date(report.generated_at).toLocaleString();

  const areaText = p.site?.area_ha ? `${Number(p.site.area_ha).toFixed(2)} ha` : 'Portfolio';
  const healthText = p.health ? p.health.replace(/_/g, ' ') : '—';
  const carbonText = p.latest?.carbon_tco2e ? `${Number(p.latest.carbon_tco2e).toFixed(1)} tCO₂e` : '—';

  const signalsHtml = p.latest ? `
    <h2>Current Environmental Signals</h2>
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Carbon Stock</div>
        <div class="kpi-value">${Number(p.latest.carbon_tco2e).toFixed(1)} tCO₂e</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Biodiversity Index</div>
        <div class="kpi-value">${Number(p.latest.biodiversity_index).toFixed(1)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">NDVI Vegetation</div>
        <div class="kpi-value">${Number(p.latest.ndvi).toFixed(3)}</div>
      </div>
      ${p.anomaly_score !== undefined ? `
      <div class="kpi">
        <div class="kpi-label">Anomaly Score</div>
        <div class="kpi-value">${Number(p.anomaly_score).toFixed(2)}</div>
      </div>` : ''}
    </div>
  ` : '';

  const reasonsHtml = p.reasons && p.reasons.length > 0 ? `
    <h2>Key Findings</h2>
    <ul>
      ${p.reasons.map((r: string) => `<li>${escapeHtml(r)}</li>`).join('')}
    </ul>
  ` : '';

  const recommendationHtml = p.recommendation ? `
    <h2>Recommended Monitoring Action</h2>
    <p>${escapeHtml(p.recommendation)}</p>
  ` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0f1916;
      color: #e7f0eb;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
      background: #16231e;
      border: 1px solid #2a3b34;
      border-radius: 14px;
      padding: 40px;
      box-shadow: 0 16px 42px rgba(0,0,0,0.3);
    }
    .eyebrow {
      font-size: 11px;
      letter-spacing: 1.5px;
      font-weight: 700;
      color: #7cc294;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    h1 {
      font-size: 28px;
      margin: 0 0 8px;
      color: #f2f7f4;
    }
    .meta {
      font-size: 12px;
      color: #8fa39a;
      border-bottom: 1px solid #263730;
      padding-bottom: 18px;
      margin-bottom: 24px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin: 18px 0 28px;
    }
    .kpi {
      background: #101b17;
      border: 1px solid #263730;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .kpi-label {
      font-size: 10px;
      color: #8fa39a;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 700;
    }
    .kpi-value {
      font-size: 20px;
      font-weight: 700;
      color: #7cc294;
      margin-top: 4px;
    }
    h2 {
      font-size: 17px;
      margin: 28px 0 10px;
      color: #cbd9d3;
      border-bottom: 1px solid #23352d;
      padding-bottom: 6px;
    }
    p {
      font-size: 13px;
      line-height: 1.75;
      color: #a7b8af;
      margin: 8px 0;
    }
    ul {
      padding-left: 22px;
      color: #a7b8af;
      font-size: 13px;
      line-height: 1.7;
    }
    li {
      margin-bottom: 6px;
    }
    .note {
      margin-top: 32px;
      padding: 14px 16px;
      border-radius: 8px;
      background: #172b23;
      border: 1px solid #285f47;
      font-size: 11px;
      color: #8dd0a1;
    }
    @media print {
      body { background: #fff; color: #111; padding: 0; }
      .container { border: none; box-shadow: none; padding: 0; background: #fff; color: #111; }
      .kpi { background: #f8faf8; border-color: #ddd; }
      .kpi-value, h1, .eyebrow { color: #166534; }
      .kpi-label, .meta, p, ul { color: #333; }
      .note { background: #f0fdf4; border-color: #86efac; color: #166534; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="eyebrow">DARUKAA.EARTH · AI-GENERATED REPORT · ${escapeHtml(typeLabel)}</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated: ${escapeHtml(dateStr)} · Report ID: ${escapeHtml(report.id)}</div>

    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Coverage Area</div>
        <div class="kpi-value">${escapeHtml(areaText)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Ecosystem Health</div>
        <div class="kpi-value">${escapeHtml(healthText)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Carbon Stock</div>
        <div class="kpi-value">${escapeHtml(carbonText)}</div>
      </div>
    </div>

    <h2>Executive Summary</h2>
    <p>${escapeHtml(p.executive_summary || 'No executive summary available.')}</p>

    ${signalsHtml}

    ${reasonsHtml}

    ${recommendationHtml}

    <div class="note">
      ✦ Grounded in site metrics, health status and autonomous geospatial ML signals.
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  a.download = `${safeTitle}_${report.id.slice(0, 8)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function Reports() {
  const n = useNavigate();
  const { data, loading } = useReports();
  const { data: portfolio } = usePortfolio();
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    const project = portfolio.projects[0];
    if (!project) return;
    setGenerating(true);
    try {
      const r = await import('../services/ai.api').then((m) =>
        m.generateReport({ projectId: project.id, reportType: 'ai_summary' })
      );
      n(`/app/reports/${r.id}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">DOCUMENTS</div>
          <h1>Reports</h1>
          <p>AI-generated summaries and autonomous monitoring reports.</p>
        </div>
        <Button onClick={() => void generate()} disabled={generating}>
          {generating ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />} Generate report
        </Button>
      </div>
      <div className="report-list">
        {loading ? (
          <div className="empty-state">Loading reports…</div>
        ) : data.length ? (
          data.map((r) => (
            <div className="card report-row" key={r.id}>
              <div className="report-icon">
                <FileText />
              </div>
              <div>
                <b>{parse(r.content).title || 'Darukaa Intelligence Report'}</b>
                <small>
                  {r.report_type.replace(/_/g, ' ')} · {new Date(r.generated_at).toLocaleString()}
                </small>
              </div>
              <div className="report-actions">
                <button onClick={() => downloadReportFile(r)} title="Direct download report">
                  <Download size={15} />
                </button>
                <Button variant="secondary" onClick={() => n(`/app/reports/${r.id}`)}>
                  Open
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="card empty-state">
            <FileText />
            <b>No reports yet</b>
            <small>Generate a grounded report from current environmental intelligence.</small>
          </div>
        )}
      </div>
    </>
  );
}

export function ReportDetail() {
  const { reportId = '' } = useParams();
  const { data, loading, error } = useReport(reportId);

  if (loading) return <div className="empty-state">Loading report…</div>;
  if (error || !data)
    return (
      <div className="error-state">
        <b>Report unavailable</b>
        <span>{error || 'Not found'}</span>
      </div>
    );

  const p = parse(data.content);

  return (
    <div className="report-document">
      <div className="report-top">
        <div>
          <div className="eyebrow">AI-GENERATED REPORT · {data.report_type.replace(/_/g, ' ').toUpperCase()}</div>
          <h1>{p.title || 'Darukaa Intelligence Report'}</h1>
          <p>Generated {new Date(data.generated_at).toLocaleString()}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </Button>
          <Button onClick={() => downloadReportFile(data)}>
            <Download size={16} /> Save
          </Button>
        </div>
      </div>
      <article>
        <div className="report-kpis">
          <div>
            <span>Area</span>
            <b>{p.site?.area_ha ? `${Number(p.site.area_ha).toFixed(2)} ha` : 'Portfolio'}</b>
          </div>
          <div>
            <span>Health</span>
            <b>{p.health?.replace(/_/g, ' ') || '—'}</b>
          </div>
          <div>
            <span>Carbon</span>
            <b>{p.latest?.carbon_tco2e ? `${Number(p.latest.carbon_tco2e).toFixed(1)} tCO₂e` : '—'}</b>
          </div>
        </div>
        <h2>Executive summary</h2>
        <p>{p.executive_summary || 'No executive summary available.'}</p>
        {p.latest && (
          <>
            <h2>Current environmental signals</h2>
            <div className="report-kpis">
              <div>
                <span>Carbon</span>
                <b>{Number(p.latest.carbon_tco2e).toFixed(1)}</b>
              </div>
              <div>
                <span>Biodiversity</span>
                <b>{Number(p.latest.biodiversity_index).toFixed(1)}</b>
              </div>
              <div>
                <span>NDVI</span>
                <b>{Number(p.latest.ndvi).toFixed(3)}</b>
              </div>
              <div>
                <span>Anomaly</span>
                <b>{Number(p.anomaly_score || 0).toFixed(2)}</b>
              </div>
            </div>
          </>
        )}
        {p.reasons?.length > 0 && (
          <>
            <h2>Key findings</h2>
            <ul>
              {p.reasons.map((x: string) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </>
        )}
        <h2>Recommended monitoring action</h2>
        <p>{p.recommendation}</p>
        <div className="report-note">
          <Sparkles /> Grounded in site metrics, health status and ML signals.
        </div>
      </article>
    </div>
  );
}

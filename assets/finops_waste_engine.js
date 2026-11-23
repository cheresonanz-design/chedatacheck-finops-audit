/**
 * FinOps & AI-Spend Auditor (B11) — Deterministic Client-Side & Node.js Engine
 * 100 % local in browser / offline CLI, zero network calls.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CheProjectEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const META = {
  "pid": "B11",
  "brand": "CheDataCheck",
  "short_name": "FinOps & AI-Spend Auditor",
  "slug": "finops_waste",
  "default_profile": "Nordwerk Digital GmbH",
  "kpi_impact_label": "Monatliche Waste-Einsparung",
  "annual_multiplier": 12
};
  const SAMPLES = {
  "s1": {
    "profile_name": "Nordwerk Digital GmbH",
    "mode": "komplett",
    "tone": "streng",
    "items": [
      {
        "id": "SAAS-01",
        "label": "Figma Org (28/45 Sitze aktiv)",
        "category": "Design / Duplikat",
        "metric": 62.2,
        "base_eur": 1980,
        "impact_eur": 748,
        "status": "FAIL",
        "note": "17 inaktive Sitze + Renewal in 18 Tagen — Downgrade vor Frist"
      },
      {
        "id": "SAAS-02",
        "label": "Notion + Confluence Parallelbetrieb",
        "category": "Wiki / Duplikat",
        "metric": 54.0,
        "base_eur": 840,
        "impact_eur": 490,
        "status": "WARN",
        "note": "Doppelte Wissensdatenbank konsolidieren"
      },
      {
        "id": "LLM-01",
        "label": "Beleg-Triage auf GPT-4o (ohne Cache)",
        "category": "AI Token Spend",
        "metric": 91.5,
        "base_eur": 1290,
        "impact_eur": 1140,
        "status": "FAIL",
        "note": "Einfache Extraktion auf Compact-Modell + Caching umstellen (-88 %)"
      },
      {
        "id": "SAAS-03",
        "label": "DATEV Unternehmen Online",
        "category": "Buchhaltung",
        "metric": 100.0,
        "base_eur": 195,
        "impact_eur": 0,
        "status": "PASS",
        "note": "Voll ausgelastetes Pflichtsystem"
      }
    ]
  },
  "s2": {
    "profile_name": "Klarstack GmbH (Bereinigt)",
    "mode": "komplett",
    "tone": "executive",
    "items": [
      {
        "id": "SAAS-10",
        "label": "M365 Business (24/25 aktiv)",
        "category": "Productivity",
        "metric": 96.0,
        "base_eur": 520,
        "impact_eur": 0,
        "status": "PASS",
        "note": "Auslastung >95 % ohne Redundanz"
      },
      {
        "id": "LLM-10",
        "label": "Classifier auf Mini + Cache",
        "category": "AI Token Spend",
        "metric": 99.0,
        "base_eur": 68,
        "impact_eur": 0,
        "status": "PASS",
        "note": "Optimal geroutet"
      }
    ]
  },
  "s3": {
    "profile_name": "Support-Automation Pipeline",
    "mode": "ai",
    "tone": "executive",
    "items": [
      {
        "id": "LLM-21",
        "label": "Ticket-Summary auf Claude Sonnet",
        "category": "AI Token Spend",
        "metric": 88.0,
        "base_eur": 980,
        "impact_eur": 710,
        "status": "FAIL",
        "note": "Routing auf Haiku + 5k System-Prompt-Cache empfohlen"
      },
      {
        "id": "SAAS-22",
        "label": "CRM Add-on Lizenzen (6 ungenutzt)",
        "category": "Sales CRM",
        "metric": 70.0,
        "base_eur": 600,
        "impact_eur": 180,
        "status": "WARN",
        "note": "6 ungenutzte Seats zum Quartalsende abbestellen"
      }
    ]
  }
};

  function r2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function evaluateCase(input = {}) {
    const profileName = String(input.profile_name || SAMPLES.s1.profile_name || META.default_profile);
    const mode = String(input.mode || SAMPLES.s1.mode || "standard");
    const tone = String(input.tone || SAMPLES.s1.tone || "executive");
    const rawItems = Array.isArray(input.items) && input.items.length ? input.items : SAMPLES.s1.items;

    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;
    let impactTotal = 0;
    let baseTotal = 0;

    const rows = rawItems.map((it, idx) => {
      const id = String(it.id || `${META.pid}-${String(idx + 1).padStart(2, "0")}`);
      const label = String(it.label || "Position");
      const category = String(it.category || "Prüfpunkt");
      const metric = Number(it.metric) || 0;
      const impact = Number(it.impact_eur) || 0;
      const base = Number(it.base_eur) || 0;
      const statusRaw = String(it.status || "").toUpperCase();
      const status = ["PASS", "WARN", "FAIL"].includes(statusRaw)
        ? statusRaw
        : impact > 0 && metric >= 70
          ? "FAIL"
          : impact > 0
            ? "WARN"
            : "PASS";

      if (status === "PASS") passCount += 1;
      else if (status === "WARN") warnCount += 1;
      else failCount += 1;

      impactTotal += impact;
      baseTotal += base;

      return {
        id,
        label,
        category,
        metric: r2(metric),
        base_eur: r2(base),
        impact_eur: r2(impact),
        status,
        note: String(it.note || (status === "PASS" ? "Regelkonform" : "Maßnahme empfohlen")),
      };
    });

    const totalCount = rows.length || 1;
    const score = r2(Math.max(0, Math.min(100, ((passCount + warnCount * 0.5) / totalCount) * 100)));
    const ok = failCount === 0;
    const annualImpact = r2(impactTotal * (Number(META.annual_multiplier) || 12));

    const headerTone = tone === "streng"
      ? `[FRIST / ESKALATION] ${profileName} (${META.pid} · Modus: ${mode})`
      : `[EXECUTIVE SUMMARY] ${profileName} (${META.pid} · Modus: ${mode})`;

    const actionLines = rows
      .filter((r) => r.status !== "PASS")
      .map((r) => `- [${r.status}] ${r.id} ${r.label}: ${r.note} (Potenzial/Risiko: ${r.impact_eur.toFixed(2)} EUR)`);

    const actionText = [
      headerTone,
      `Readiness-Score: ${score} % | Geprüft: ${rows.length} | PASS: ${passCount} | WARN: ${warnCount} | FAIL: ${failCount}`,
      `${META.kpi_impact_label}: ${impactTotal.toFixed(2)} EUR (Hochgerechnet p.a.: ${annualImpact.toFixed(2)} EUR)`,
      "",
      actionLines.length ? "Priorisierte Maßnahmen:" : "Alle geprüften Punkte erfüllen die DACH-Vorgaben ohne Beanstandung.",
      ...actionLines,
      "",
      `Erstellt lokal mit ${META.brand} ${META.short_name} (by VeriTakt Collective) — 0 Cloud-Upload.`
    ].join("\n");

    const csvHeader = "ID;Kategorie;Position;Kennzahl;Basis_EUR;Effekt_EUR;Status;Hinweis";
    const csvRows = rows.map((r) =>
      [r.id, r.category, r.label, r.metric.toFixed(2), r.base_eur.toFixed(2), r.impact_eur.toFixed(2), r.status, r.note]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";")
    );
    const exportCsv = "\uFEFF" + [csvHeader, ...csvRows].join("\n");

    return {
      ok,
      project_id: META.pid,
      brand: META.brand,
      profile_name: profileName,
      mode,
      tone,
      readiness_percent: score,
      summary: {
        total_count: rows.length,
        pass_count: passCount,
        warn_count: warnCount,
        fail_count: failCount,
      },
      base_total_eur: r2(baseTotal),
      impact_eur: r2(impactTotal),
      annual_impact_eur: annualImpact,
      entries: rows,
      action_text: actionText,
      export_csv: exportCsv,
    };
  }

  function formatAuditReportMarkdown(res) {
    return [
      `# ${META.brand} ${META.short_name} — Audit Report (${res.profile_name})`,
      `- **Score:** ${res.readiness_percent} % | **FAIL:** ${res.summary.fail_count} | **WARN:** ${res.summary.warn_count}`,
      `- **${META.kpi_impact_label}:** ${res.impact_eur.toFixed(2)} EUR (Jahr: ${res.annual_impact_eur.toFixed(2)} EUR)`,
      "",
      "## Maßnahmen & Empfehlung",
      res.action_text,
    ].join("\n");
  }

  function formatAuditReportJson(res) {
    return JSON.stringify(res, null, 2);
  }

  return {
    META,
    SAMPLES,
    evaluateCase,
    formatAuditReportMarkdown,
    formatAuditReportJson,
  };
});

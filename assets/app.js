(function () {
  "use strict";
  const engine = window.CheFinOpsEngine;
  if (!engine) return;

  let saasRows = engine.SAMPLES.s1.saas_rows.map((x) => ({ ...x }));
  let aiRows = engine.SAMPLES.s1.ai_rows.map((x) => ({ ...x }));
  let lastRes = null;

  const el = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function toBatchCsv() {
    const lines = ["TYP;NAME;KATEGORIE_ODER_MODELL;WERT1;WERT2;PREIS_ODER_OUT_TOK;ZYKLUS_ODER_COMPLEXITY;RENEWAL_ODER_CACHE"];
    saasRows.forEach((s) => {
      lines.push(
        ["SAAS", s.vendor, s.category, s.seats_purchased, s.seats_active_30d, s.price_per_seat_eur, s.billing_cycle, s.auto_renew_days]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";")
      );
    });
    aiRows.forEach((a) => {
      lines.push(
        ["AI", a.workflow_name, a.model, a.monthly_calls, a.avg_input_tokens, a.avg_output_tokens, a.complexity_tier, a.caching_enabled ? "1" : "0"]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";")
      );
    });
    return lines.join("\n");
  }

  function parseCsvLine(line, sep) {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (ch === '"') {
          inQ = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === sep) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }

  function importBatchCsv(text) {
    const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const sep = lines[0].includes(";") ? ";" : ",";
    const nextSaas = [];
    const nextAi = [];
    lines.forEach((line, idx) => {
      const c = parseCsvLine(line, sep);
      if (idx === 0 && /^typ/i.test(c[0] || "")) return;
      const typ = String(c[0] || "SAAS").toUpperCase();
      if (typ === "AI" || typ === "LLM") {
        nextAi.push({
          workflow_name: c[1] || "AI Workflow",
          model: c[2] || "gpt-4o",
          monthly_calls: parseFloat(c[3]) || 0,
          avg_input_tokens: parseFloat(c[4]) || 0,
          avg_output_tokens: parseFloat(c[5]) || 0,
          complexity_tier: (c[6] || "simple").toLowerCase(),
          caching_enabled: ["1", "true", "ja", "yes"].includes(String(c[7] || "").toLowerCase()),
        });
      } else if (c[1]) {
        nextSaas.push({
          vendor: c[1],
          category: c[2] || "Allgemein",
          seats_purchased: parseFloat(c[3]) || 1,
          seats_active_30d: parseFloat(c[4]) || 0,
          price_per_seat_eur: parseFloat(String(c[5] || "0").replace(",", ".")) || 0,
          billing_cycle: c[6] || "monthly",
          auto_renew_days: parseFloat(c[7]) || 365,
        });
      }
    });
    saasRows = nextSaas;
    aiRows = nextAi;
  }

  function syncCsvBox() {
    if (el("batchCsvInput")) el("batchCsvInput").value = toBatchCsv();
  }

  function applySample(s) {
    el("profileInput").value = s.profile_name;
    el("modeSelect").value = s.mode;
    el("toneSelect").value = s.tone;
    saasRows = (s.saas_rows || []).map((x) => ({ ...x }));
    aiRows = (s.ai_rows || []).map((x) => ({ ...x }));
    syncCsvBox();
    runCheck();
  }

  function runCheck() {
    const res = engine.runFinOpsAudit({
      profile_name: el("profileInput").value,
      mode: el("modeSelect").value,
      tone: el("toneSelect").value,
      saas_rows: saasRows,
      ai_rows: aiRows,
    });
    lastRes = res;
    el("resultCard").classList.remove("hidden");
    el("kpi1Val").textContent = `${res.readiness_percent.toFixed(1)} %`;
    el("kpi2Val").textContent = `${res.summary.fail_count} FAIL / ${res.summary.warn_count} WARN`;
    el("kpi3Val").textContent = `${res.impact_eur.toFixed(2)} EUR`;
    el("kpi4Val").textContent = `${res.annual_impact_eur.toFixed(2)} EUR`;
    el("resultHeadline").textContent = res.ok
      ? `${res.profile_name}: Kostenstruktur sauber (${res.total_monthly_spend_eur.toFixed(2)} EUR/Mo.)`
      : `${res.profile_name}: ${res.impact_eur.toFixed(2)} EUR/Mo. Einsparpotenzial erkannt`;
    el("actionBox").value = res.action_text;

    if (!res.entries.length) {
      el("entriesBody").innerHTML = '<tr><td colspan="7" class="muted">Keine Positionen aktiv. Fügen Sie oben einen SaaS-Vertrag oder KI-Workflow hinzu.</td></tr>';
      return;
    }

    el("entriesBody").innerHTML = res.entries
      .map((e) => {
        const cls = e.status === "PASS" ? "badge-pass" : e.status === "WARN" ? "badge-warn" : "badge-fail";
        return `<tr>
          <td><code>${esc(e.id)}</code></td>
          <td><strong>${esc(e.label)}</strong><div class="muted">${esc(e.category)} · Ist: ${e.base_eur.toFixed(2)} EUR/Mo.</div></td>
          <td>${esc(e.metric_label)}</td>
          <td><strong>${e.impact_eur.toFixed(2)} EUR</strong></td>
          <td><span class="badge ${cls}">${esc(e.status)}</span></td>
          <td>${esc(e.note)}</td>
          <td><button type="button" class="btn btn-sm remove-item-btn" data-id="${esc(e.id)}">&times;</button></td>
        </tr>`;
      })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!el("runCheckBtn")) return;
    el("runCheckBtn").addEventListener("click", runCheck);
    el("modeSelect").addEventListener("change", runCheck);
    el("toneSelect").addEventListener("change", runCheck);
    el("sample1Btn").addEventListener("click", () => applySample(engine.SAMPLES.s1));
    el("sample2Btn").addEventListener("click", () => applySample(engine.SAMPLES.s2));
    el("sample3Btn").addEventListener("click", () => applySample(engine.SAMPLES.s3));

    if (el("addSaasBtn")) {
      el("addSaasBtn").addEventListener("click", () => {
        const vendor = (el("saasVendorInput").value || "").trim();
        if (!vendor) return el("saasVendorInput").focus();
        saasRows.push({
          vendor,
          category: (el("saasCatInput").value || "").trim() || "Allgemein",
          seats_purchased: parseInt(el("saasPurchasedInput").value, 10) || 1,
          seats_active_30d: parseInt(el("saasActiveInput").value, 10) || 0,
          price_per_seat_eur: parseFloat(el("saasPriceInput").value) || 0,
          billing_cycle: el("saasCycleSelect").value || "monthly",
          auto_renew_days: parseInt(el("saasRenewInput").value, 10) || 90,
        });
        el("saasVendorInput").value = "";
        syncCsvBox();
        runCheck();
      });
    }

    if (el("addAiBtn")) {
      el("addAiBtn").addEventListener("click", () => {
        const wf = (el("aiWorkflowInput").value || "").trim();
        if (!wf) return el("aiWorkflowInput").focus();
        aiRows.push({
          workflow_name: wf,
          model: el("aiModelSelect").value || "gpt-4o",
          monthly_calls: parseInt(el("aiCallsInput").value, 10) || 1000,
          avg_input_tokens: parseInt(el("aiInTokInput").value, 10) || 1500,
          avg_output_tokens: parseInt(el("aiOutTokInput").value, 10) || 250,
          complexity_tier: el("aiComplexSelect").value || "simple",
          caching_enabled: Boolean(el("aiCacheCheck").checked),
        });
        el("aiWorkflowInput").value = "";
        syncCsvBox();
        runCheck();
      });
    }

    el("clearItemsBtn").addEventListener("click", () => {
      saasRows = [];
      aiRows = [];
      syncCsvBox();
      runCheck();
    });

    el("applyCsvBtn").addEventListener("click", () => {
      importBatchCsv(el("batchCsvInput").value);
      syncCsvBox();
      runCheck();
    });

    el("entriesBody").addEventListener("click", (ev) => {
      const btn = ev.target.closest(".remove-item-btn");
      if (!btn) return;
      const eid = btn.getAttribute("data-id") || "";
      if (eid.startsWith("SAAS-")) {
        const idx = parseInt(eid.replace("SAAS-", ""), 10) - 1;
        if (idx >= 0 && idx < saasRows.length) saasRows.splice(idx, 1);
      } else if (eid.startsWith("LLM-")) {
        const idx = parseInt(eid.replace("LLM-", ""), 10) - 1;
        if (idx >= 0 && idx < aiRows.length) aiRows.splice(idx, 1);
      }
      syncCsvBox();
      runCheck();
    });

    el("copyActionBtn").addEventListener("click", async () => {
      if (!lastRes || !navigator.clipboard) return;
      await navigator.clipboard.writeText(lastRes.action_text);
      el("copyActionBtn").textContent = "Text kopiert!";
      setTimeout(() => (el("copyActionBtn").textContent = "Maßnahmentext kopieren"), 1800);
    });
    el("dlCsvBtn").addEventListener("click", () => {
      if (!lastRes) return;
      const blob = new Blob([lastRes.export_csv], { type: "text/csv;charset=utf-8" });
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = "chedatacheck_finops_export.csv";
      a.click();
      URL.revokeObjectURL(u);
    });
    el("dlJsonBtn").addEventListener("click", () => {
      if (!lastRes) return;
      const blob = new Blob([engine.formatAuditReportJson(lastRes)], { type: "application/json" });
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = "chedatacheck_finops_audit.json";
      a.click();
      URL.revokeObjectURL(u);
    });

    applySample(engine.SAMPLES.s1);
  });
})();

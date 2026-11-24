/**
 * CheDataCheck FinOps (B11) — Real Deterministic SaaS-Seat, Renewal & AI-Token Waste Auditor
 * 100 % local in browser or Node.js (EUR-only, zero network calls).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CheFinOpsEngine = api;
  root.CheProjectEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const META = {
    pid: "B11",
    brand: "CheDataCheck",
    short_name: "FinOps & AI-Spend Auditor",
    slug: "finops_waste",
    default_profile: "Nordwerk Digital GmbH",
    kpi_impact_label: "Monatliche Waste-Einsparung",
    annual_multiplier: 12,
  };

  const MODEL_PRICING_PER_1M_EUR = {
    "gpt-4o": { input: 2.30, output: 9.20, tier: "frontier", downgrade_to: "gpt-4o-mini" },
    "gpt-4o-mini": { input: 0.14, output: 0.55, tier: "compact", downgrade_to: null },
    "claude-sonnet": { input: 2.75, output: 13.80, tier: "frontier", downgrade_to: "claude-haiku" },
    "claude-haiku": { input: 0.74, output: 3.70, tier: "compact", downgrade_to: null },
    "gemini-pro": { input: 1.15, output: 4.60, tier: "frontier", downgrade_to: "gemini-flash" },
    "gemini-flash": { input: 0.07, output: 0.28, tier: "compact", downgrade_to: null },
  };

  const SAMPLES = {
    s1: {
      profile_name: "Nordwerk Digital GmbH",
      mode: "komplett",
      tone: "streng",
      saas_rows: [
        { vendor: "Figma Org", category: "Design", seats_purchased: 45, seats_active_30d: 28, price_per_seat_eur: 44, billing_cycle: "monthly", auto_renew_days: 18 },
        { vendor: "Notion Plus", category: "Wiki", seats_purchased: 35, seats_active_30d: 34, price_per_seat_eur: 10, billing_cycle: "monthly", auto_renew_days: 120 },
        { vendor: "Confluence", category: "Wiki", seats_purchased: 35, seats_active_30d: 9, price_per_seat_eur: 8, billing_cycle: "monthly", auto_renew_days: 29 },
        { vendor: "DATEV Unternehmen Online", category: "Buchhaltung", seats_purchased: 6, seats_active_30d: 6, price_per_seat_eur: 32.5, billing_cycle: "monthly", auto_renew_days: 240 },
      ],
      ai_rows: [
        { workflow_name: "Beleg-Triage & Extraktion", model: "gpt-4o", monthly_calls: 180000, avg_input_tokens: 2400, avg_output_tokens: 280, complexity_tier: "simple", caching_enabled: false },
        { workflow_name: "Vertrags-Erstklassifizierung", model: "claude-sonnet", monthly_calls: 65000, avg_input_tokens: 3200, avg_output_tokens: 350, complexity_tier: "simple", caching_enabled: false },
      ],
    },
    s2: {
      profile_name: "Klarstack GmbH (Konsolidiert)",
      mode: "komplett",
      tone: "executive",
      saas_rows: [
        { vendor: "Microsoft 365 Business", category: "Productivity", seats_purchased: 25, seats_active_30d: 25, price_per_seat_eur: 20.6, billing_cycle: "monthly", auto_renew_days: 180 },
        { vendor: "Linear", category: "PM", seats_purchased: 18, seats_active_30d: 18, price_per_seat_eur: 8, billing_cycle: "monthly", auto_renew_days: 210 },
      ],
      ai_rows: [
        { workflow_name: "Ticket-Classifier", model: "gpt-4o-mini", monthly_calls: 90000, avg_input_tokens: 1100, avg_output_tokens: 120, complexity_tier: "simple", caching_enabled: true },
      ],
    },
    s3: {
      profile_name: "Support-Automation Pipeline",
      mode: "ai",
      tone: "executive",
      saas_rows: [
        { vendor: "CRM Add-on Lizenzen", category: "Sales CRM", seats_purchased: 20, seats_active_30d: 14, price_per_seat_eur: 35, billing_cycle: "monthly", auto_renew_days: 38 },
      ],
      ai_rows: [
        { workflow_name: "Ticket-Summary Batch", model: "claude-sonnet", monthly_calls: 140000, avg_input_tokens: 4500, avg_output_tokens: 420, complexity_tier: "simple", caching_enabled: false },
        { workflow_name: "Architektur-Analyse (Complex)", model: "gemini-pro", monthly_calls: 12000, avg_input_tokens: 3000, avg_output_tokens: 600, complexity_tier: "complex", caching_enabled: false },
      ],
    },
  };

  function r2(val) {
    return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
  }

  function normalizeMonthlyPrice(price, cycle) {
    const num = Math.max(0, Number(price) || 0);
    return String(cycle || "monthly").toLowerCase().startsWith("ann") || String(cycle || "").toLowerCase().startsWith("jähr")
      ? num / 12
      : num;
  }

  function estimateTokenMonthlyCost(modelName, calls, avgIn, avgOut, cachingEnabled) {
    const rates = MODEL_PRICING_PER_1M_EUR[modelName] || MODEL_PRICING_PER_1M_EUR["gpt-4o"];
    const totalInM = (calls * avgIn) / 1_000_000;
    const totalOutM = (calls * avgOut) / 1_000_000;
    const effectiveInFactor = cachingEnabled ? 0.55 : 1.0;
    return r2(totalInM * rates.input * effectiveInFactor + totalOutM * rates.output);
  }

  function auditSaasSeats(rows = []) {
    const categoryMap = new Map();
    const findings = [];
    let totalMonthlySpendEur = 0;
    let totalMonthlyWasteEur = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const purchased = Math.max(0, Math.round(Number(row.seats_purchased) || 0));
      const active = Math.max(0, Math.min(purchased, Math.round(Number(row.seats_active_30d) || 0)));
      const unitMonthly = normalizeMonthlyPrice(row.price_per_seat_eur, row.billing_cycle);
      const monthlySpend = r2(purchased * unitMonthly);
      const idleSeats = purchased - active;
      const monthlyWaste = r2(idleSeats * unitMonthly);
      const utilizationPct = purchased > 0 ? r2((active / purchased) * 100) : 100;
      const renewDays = Number.isFinite(Number(row.auto_renew_days)) ? Math.max(0, Math.round(Number(row.auto_renew_days))) : 365;

      totalMonthlySpendEur += monthlySpend;
      totalMonthlyWasteEur += monthlyWaste;

      const flags = [];
      if (idleSeats > 0) flags.push("IDLE_SEATS");
      if (utilizationPct < 65 && purchased >= 3) flags.push("UNDERUTILIZED_TIER");
      if (renewDays <= 45) flags.push("RENEWAL_WINDOW_ALERT");

      const cat = String(row.category || "Allgemein").trim();
      const catKey = cat.toLowerCase();
      if (!categoryMap.has(catKey)) categoryMap.set(catKey, []);
      categoryMap.get(catKey).push(row.vendor || `Tool-${i + 1}`);

      findings.push({
        id: `SAAS-${String(i + 1).padStart(2, "0")}`,
        vendor: String(row.vendor || `SaaS Tool ${i + 1}`),
        category: cat,
        seats_purchased: purchased,
        seats_active_30d: active,
        idle_seats: idleSeats,
        price_per_seat_eur: r2(unitMonthly),
        utilization_pct: utilizationPct,
        monthly_spend_eur: monthlySpend,
        monthly_waste_eur: monthlyWaste,
        annual_waste_eur: r2(monthlyWaste * 12),
        auto_renew_days: renewDays,
        flags,
      });
    }

    const duplicateCategories = [];
    for (const [catKey, vendors] of categoryMap.entries()) {
      if (vendors.length > 1) {
        duplicateCategories.push({ category: catKey, vendors });
        for (const f of findings) {
          if (f.category.toLowerCase() === catKey && !f.flags.includes("DUPLICATE_TOOL_CATEGORY")) {
            f.flags.push("DUPLICATE_TOOL_CATEGORY");
          }
        }
      }
    }

    return {
      tool_count: findings.length,
      total_monthly_spend_eur: r2(totalMonthlySpendEur),
      total_monthly_waste_eur: r2(totalMonthlyWasteEur),
      total_annual_waste_eur: r2(totalMonthlyWasteEur * 12),
      duplicate_categories: duplicateCategories,
      findings,
    };
  }

  function auditAiTokenSpend(rows = []) {
    const findings = [];
    let currentMonthlyEur = 0;
    let optimizedMonthlyEur = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const model = MODEL_PRICING_PER_1M_EUR[row.model] ? row.model : "gpt-4o";
      const calls = Math.max(0, Number(row.monthly_calls) || 0);
      const avgIn = Math.max(0, Number(row.avg_input_tokens) || 0);
      const avgOut = Math.max(0, Number(row.avg_output_tokens) || 0);
      const complexity = String(row.complexity_tier || "simple").toLowerCase() === "complex" ? "complex" : "simple";
      const caching = Boolean(row.caching_enabled);

      const rates = MODEL_PRICING_PER_1M_EUR[model];
      const currentCost = estimateTokenMonthlyCost(model, calls, avgIn, avgOut, caching);

      let recommendedModel = model;
      const actions = [];
      if (rates.tier === "frontier" && complexity === "simple" && rates.downgrade_to) {
        recommendedModel = rates.downgrade_to;
        actions.push("DOWNGRADE_MODEL_TIER");
      }
      const recommendCache = !caching && avgIn >= 1500 && calls >= 500;
      if (recommendCache) {
        actions.push("ENABLE_PROMPT_CACHE");
      }

      const optimizedCost = estimateTokenMonthlyCost(recommendedModel, calls, avgIn, avgOut, caching || recommendCache);
      const monthlySavings = r2(Math.max(0, currentCost - optimizedCost));

      currentMonthlyEur += currentCost;
      optimizedMonthlyEur += optimizedCost;

      findings.push({
        id: `LLM-${String(i + 1).padStart(2, "0")}`,
        workflow_name: String(row.workflow_name || `AI Workflow ${i + 1}`),
        current_model: model,
        recommended_model: recommendedModel,
        complexity_tier: complexity,
        monthly_calls: calls,
        avg_input_tokens: avgIn,
        avg_output_tokens: avgOut,
        caching_enabled: caching,
        current_monthly_eur: currentCost,
        optimized_monthly_eur: optimizedCost,
        monthly_savings_eur: monthlySavings,
        annual_savings_eur: r2(monthlySavings * 12),
        actions,
      });
    }

    const totalSavings = r2(Math.max(0, currentMonthlyEur - optimizedMonthlyEur));
    return {
      workflow_count: findings.length,
      current_monthly_eur: r2(currentMonthlyEur),
      optimized_monthly_eur: r2(optimizedMonthlyEur),
      total_monthly_savings_eur: totalSavings,
      total_annual_savings_eur: r2(totalSavings * 12),
      findings,
    };
  }

  function runFinOpsAudit(input = {}) {
    const profileName = String(input.profile_name || META.default_profile);
    const mode = String(input.mode || "komplett");
    const tone = String(input.tone || "executive");

    const saasInput = mode === "ai" ? [] : (Array.isArray(input.saas_rows) ? input.saas_rows : SAMPLES.s1.saas_rows);
    const aiInput = mode === "saas" ? [] : (Array.isArray(input.ai_rows) ? input.ai_rows : SAMPLES.s1.ai_rows);

    const saas = auditSaasSeats(saasInput);
    const ai = auditAiTokenSpend(aiInput);

    const entries = [];
    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;

    for (const s of saas.findings) {
      const hasDup = s.flags.includes("DUPLICATE_TOOL_CATEGORY");
      const hasRenew = s.flags.includes("RENEWAL_WINDOW_ALERT");
      const status =
        (s.idle_seats > 0 && (hasRenew || s.utilization_pct < 75)) || (hasDup && s.utilization_pct < 60)
          ? "FAIL"
          : s.idle_seats > 0 || hasDup || hasRenew
            ? "WARN"
            : "PASS";
      if (status === "PASS") passCount += 1;
      else if (status === "WARN") warnCount += 1;
      else failCount += 1;

      const noteParts = [];
      if (s.idle_seats > 0) noteParts.push(`${s.idle_seats} inaktive Sitze (${s.monthly_waste_eur.toFixed(2)} EUR/Mo.)`);
      if (hasDup) noteParts.push(`Kategorie-Duplikat '${s.category}' konsolidieren`);
      if (hasRenew) noteParts.push(`Renewal in ${s.auto_renew_days} Tagen`);
      if (!noteParts.length) noteParts.push("Auslastung optimal (>90 %)");

      entries.push({
        id: s.id,
        kind: "SAAS",
        label: `${s.vendor} (${s.seats_active_30d}/${s.seats_purchased} aktiv)`,
        category: s.category,
        metric: s.utilization_pct,
        metric_label: `${s.utilization_pct.toFixed(1)} % Aktiv`,
        base_eur: s.monthly_spend_eur,
        impact_eur: s.monthly_waste_eur,
        status,
        note: noteParts.join(" · "),
      });
    }

    for (const a of ai.findings) {
      const hasDowngrade = a.actions.includes("DOWNGRADE_MODEL_TIER");
      const hasCache = a.actions.includes("ENABLE_PROMPT_CACHE");
      const status = hasDowngrade && a.monthly_savings_eur >= 25 ? "FAIL" : hasDowngrade || hasCache ? "WARN" : "PASS";
      if (status === "PASS") passCount += 1;
      else if (status === "WARN") warnCount += 1;
      else failCount += 1;

      const noteParts = [];
      if (hasDowngrade) noteParts.push(`Routing ${a.current_model} -> ${a.recommended_model}`);
      if (hasCache) noteParts.push("Prompt-Caching aktivieren (-45 % Input-Tokens)");
      if (!noteParts.length) noteParts.push(`Optimal geroutet (${a.current_model})`);

      entries.push({
        id: a.id,
        kind: "AI_LLM",
        label: `${a.workflow_name} (${a.current_model})`,
        category: `AI Tokens (${a.complexity_tier})`,
        metric: a.current_monthly_eur > 0 ? r2(((a.current_monthly_eur - a.monthly_savings_eur) / a.current_monthly_eur) * 100) : 100,
        metric_label: `${(a.monthly_calls / 1000).toFixed(0)}k Calls/Mo.`,
        base_eur: a.current_monthly_eur,
        impact_eur: a.monthly_savings_eur,
        status,
        note: noteParts.join(" · "),
      });
    }

    const totalMonthlySpendEur = r2(saas.total_monthly_spend_eur + ai.current_monthly_eur);
    const totalMonthlySavingsEur = r2(saas.total_monthly_waste_eur + ai.total_monthly_savings_eur);
    const totalAnnualSavingsEur = r2(totalMonthlySavingsEur * 12);
    const efficiencyPct = totalMonthlySpendEur > 0
      ? r2(Math.max(0, ((totalMonthlySpendEur - totalMonthlySavingsEur) / totalMonthlySpendEur) * 100))
      : 100;

    const headerTone =
      tone === "streng"
        ? `[SOFORTIGER KÜNDIGUNGS- & DOWNGRADE-STOPP] ${profileName} (FinOps B11)`
        : `[CFO EXECUTIVE FINOPS SUMMARY] ${profileName} (FinOps B11)`;

    const actionLines = entries
      .filter((e) => e.status !== "PASS")
      .map((e) => `- [${e.status}] ${e.id} ${e.label}: ${e.note} -> Einsparung: ${e.impact_eur.toFixed(2)} EUR/Mo.`);

    const actionText = [
      headerTone,
      `Spend-Effizienz: ${efficiencyPct.toFixed(1)} % | Aktuelle Kosten: ${totalMonthlySpendEur.toFixed(2)} EUR/Mo. | Einsparung: ${totalMonthlySavingsEur.toFixed(2)} EUR/Mo. (${totalAnnualSavingsEur.toFixed(2)} EUR/Jahr)`,
      `Geprüft: ${entries.length} Positionen (${saas.tool_count} SaaS-Verträge, ${ai.workflow_count} KI-Workflows) | FAIL: ${failCount} | WARN: ${warnCount}`,
      "",
      actionLines.length ? "Priorisierte Maßnahmen:" : "Alle SaaS-Sitze und KI-Workflows sind kostenoptimal konfiguriert.",
      ...actionLines,
      "",
      "Erstellt 100 % lokal mit CheDataCheck FinOps (by VeriTakt Collective) — ohne Server-Upload.",
    ].join("\n");

    const csvHeader = "ID;Typ;Bezeichnung;Kategorie;Ist_EUR_Monat;Einsparung_EUR_Monat;Status;Massnahme";
    const csvRows = entries.map((e) =>
      [e.id, e.kind, e.label, e.category, e.base_eur.toFixed(2), e.impact_eur.toFixed(2), e.status, e.note]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";")
    );

    return {
      ok: failCount === 0,
      project_id: META.pid,
      brand: META.brand,
      profile_name: profileName,
      mode,
      tone,
      readiness_percent: efficiencyPct,
      total_monthly_spend_eur: totalMonthlySpendEur,
      impact_eur: totalMonthlySavingsEur,
      annual_impact_eur: totalAnnualSavingsEur,
      summary: {
        total_count: entries.length,
        pass_count: passCount,
        warn_count: warnCount,
        fail_count: failCount,
        saas_tools: saas.tool_count,
        ai_workflows: ai.workflow_count,
      },
      saas,
      ai,
      entries,
      action_text: actionText,
      export_csv: "\uFEFF" + [csvHeader, ...csvRows].join("\n"),
    };
  }

  function formatAuditReportMarkdown(res) {
    return [
      `# CheDataCheck FinOps — Audit Report (${res.profile_name})`,
      `- **Spend-Effizienz:** ${res.readiness_percent} % | **FAIL:** ${res.summary.fail_count} | **WARN:** ${res.summary.warn_count}`,
      `- **Einsparpotenzial:** ${res.impact_eur.toFixed(2)} EUR/Monat (${res.annual_impact_eur.toFixed(2)} EUR/Jahr)`,
      "",
      res.action_text,
    ].join("\n");
  }

  function formatAuditReportJson(res) {
    return JSON.stringify(res, null, 2);
  }

  return {
    META,
    MODEL_PRICING_PER_1M_EUR,
    SAMPLES,
    auditSaasSeats,
    auditAiTokenSpend,
    runFinOpsAudit,
    evaluateCase: runFinOpsAudit,
    formatAuditReportMarkdown,
    formatAuditReportJson,
  };
});

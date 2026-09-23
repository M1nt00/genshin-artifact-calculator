/* Genshin build card (akasha-style layout) — vanilla JS, no dependencies.
 *
 *   renderBuildCard(container, data, options?) -> HTMLElement
 *
 * `data` shape: see the demo object in index.html (all stat keys are enka's FIGHT_PROP_* names).
 * options:
 *   width      : rendered width in px (default 980, the base size; height scales with it)
 *   rvStats    : stat keys that count toward RV (default: crit rate, crit dmg, atk%)
 *   backgrounds: { Electro: "bg/electro.png", ... } — enka's element background images.
 *                Elements not listed fall back to the drawn (canvas) background.
 *   artPosition: CSS object-position for the splash art (default "50% 30%")
 *   assetBase  : path prefix for the icons/ and bg/ folders (default "", i.e. next to the page)
 */
(function (global) {
  "use strict";

  // ---------- stat metadata ----------
  // maxRoll = highest single 5★ substat roll, used for RV (roll value).
  const STAT = {
    FIGHT_PROP_HP:                { ko: "HP",              short: "HP",   pct: false, icon: "hp",   maxRoll: 298.75 },
    FIGHT_PROP_HP_PERCENT:        { ko: "HP%",             short: "HP%",  pct: true,  icon: "hpp",  maxRoll: 5.83 },
    FIGHT_PROP_ATTACK:            { ko: "공격력",          short: "공격력", pct: false, icon: "atk",  maxRoll: 19.45 },
    FIGHT_PROP_ATTACK_PERCENT:    { ko: "공격력%",         short: "공%",  pct: true,  icon: "atkp", maxRoll: 5.83 },
    FIGHT_PROP_DEFENSE:           { ko: "방어력",          short: "방어력", pct: false, icon: "def",  maxRoll: 23.15 },
    FIGHT_PROP_DEFENSE_PERCENT:   { ko: "방어력%",         short: "방%",  pct: true,  icon: "defp", maxRoll: 7.29 },
    FIGHT_PROP_ELEMENT_MASTERY:   { ko: "원소 마스터리",   short: "원마", pct: false, icon: "em",   maxRoll: 23.31 },
    FIGHT_PROP_CHARGE_EFFICIENCY: { ko: "원소 충전 효율",  short: "원충", pct: true,  icon: "er",   maxRoll: 6.48 },
    FIGHT_PROP_CRITICAL:          { ko: "치명타 확률",     short: "치확", pct: true,  icon: "cr",   maxRoll: 3.89 },
    FIGHT_PROP_CRITICAL_HURT:     { ko: "치명타 피해",     short: "치피", pct: true,  icon: "cd",   maxRoll: 7.77 },
    FIGHT_PROP_HEAL_ADD:          { ko: "치유 보너스",     short: "치유", pct: true,  icon: "heal" },
    FIGHT_PROP_PHYSICAL_ADD_HURT: { ko: "물리 피해 보너스", short: "물리", pct: true,  icon: "phys" },
    FIGHT_PROP_FIRE_ADD_HURT:     { ko: "불 원소 피해 보너스",   short: "불", pct: true, icon: "pyro", color: "#ff8a5c" },
    FIGHT_PROP_WATER_ADD_HURT:    { ko: "물 원소 피해 보너스",   short: "물", pct: true, icon: "hydro", color: "#4cc2ff" },
    FIGHT_PROP_WIND_ADD_HURT:     { ko: "바람 원소 피해 보너스", short: "바람", pct: true, icon: "anemo", color: "#74e2c4" },
    FIGHT_PROP_ELEC_ADD_HURT:     { ko: "번개 원소 피해 보너스", short: "번개", pct: true, icon: "electro", color: "#c28bff" },
    FIGHT_PROP_ICE_ADD_HURT:      { ko: "얼음 원소 피해 보너스", short: "얼음", pct: true, icon: "cryo", color: "#9fe6f5" },
    FIGHT_PROP_ROCK_ADD_HURT:     { ko: "바위 원소 피해 보너스", short: "바위", pct: true, icon: "geo", color: "#f5c55a" },
    FIGHT_PROP_GRASS_ADD_HURT:    { ko: "풀 원소 피해 보너스",   short: "풀", pct: true, icon: "dendro", color: "#a5d85b" },
  };

  // enka appendPropId -> substat key (id is 501 + type code + tier digit)
  const APPEND_PREFIX = {
    50102: "FIGHT_PROP_HP", 50103: "FIGHT_PROP_HP_PERCENT",
    50105: "FIGHT_PROP_ATTACK", 50106: "FIGHT_PROP_ATTACK_PERCENT",
    50108: "FIGHT_PROP_DEFENSE", 50109: "FIGHT_PROP_DEFENSE_PERCENT",
    50120: "FIGHT_PROP_CRITICAL", 50122: "FIGHT_PROP_CRITICAL_HURT",
    50123: "FIGHT_PROP_CHARGE_EFFICIENCY", 50124: "FIGHT_PROP_ELEMENT_MASTERY",
  };

  /** Count rolls per substat from an enka reliquary.appendPropIdList. */
  function countRolls(appendPropIdList) {
    const out = {};
    (appendPropIdList || []).forEach((id) => {
      const key = APPEND_PREFIX[Math.floor(id / 10)];
      if (key) out[key] = (out[key] || 0) + 1;
    });
    return out;
  }

  const ELEMENT_BG = {
    Electro: ["#22093f", "#4b2379", "#8a5cb8"],
    Pyro:    ["#3a0d0d", "#7a2a1f", "#c0693f"],
    Hydro:   ["#0a1a44", "#1f4d8f", "#4f93cc"],
    Anemo:   ["#08302d", "#1d6b5e", "#4fae96"],
    Cryo:    ["#0f2944", "#2f6b93", "#83c1dd"],
    Geo:     ["#35220a", "#7a5620", "#c49a45"],
    Dendro:  ["#12300f", "#3a6a25", "#7fb255"],
  };

  // border / glow colour of the artifact cards, per element
  const ELEMENT_COLOR = {
    Pyro: "#ff9d6e", Hydro: "#62c6ff", Anemo: "#72e3c6", Electro: "#c79dff",
    Cryo: "#a6ecff", Geo: "#f2c865", Dendro: "#a3d65c",
  };

  // enka.network element backgrounds (captured from enka's card). Paths are relative to the page.
  const DEFAULT_BACKGROUNDS = {
    Pyro: "bg/pyro.png", Hydro: "bg/hydro.png", Anemo: "bg/anemo.png", Electro: "bg/electro.png",
    Cryo: "bg/cryo.png", Geo: "bg/geo.png", Dendro: "bg/dendro.png",
  };

  // Stat / UI icons (from akasha.cv), stored as icons/<name>.png. Change ASSET_BASE if the folder lives elsewhere.
  let ASSET_BASE = "";


  function icon(key) {
    const m = STAT[key] || {};
    return `<img class="ak-ic" src="${ASSET_BASE}icons/${m.icon || "phys"}.png" alt="">`;
  }

  const friendIcon = () => `<img class="ak-ic" src="${ASSET_BASE}icons/friendship.png" alt="">`;

  // ---------- rating grade ----------
  // score -> grade. Thresholds: SS 90+, S 77.5+, A 65+, B 52.5+, C 40+, D <40, 측정불가 <=0
  const GRADES = [
    { min: 90,   grade: "SS", c1: "#ff3d6e", c2: "#ffc94d" },
    { min: 77.5, grade: "S",  c1: "#ff8a00", c2: "#ffd46b" },
    { min: 65,   grade: "A",  c1: "#ff2d9b", c2: "#ff9fd8" },
    { min: 52.5, grade: "B",  c1: "#2f7dff", c2: "#8fc4ff" },
    { min: 40,   grade: "C",  c1: "#1fae66", c2: "#8ee3b4" },
  ];
  // html2canvas (used for the PNG download) can't parse the CSS color-mix() function,
  // so the darkened outline colour is precomputed here in JS instead of at paint time.
  function darken(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (shift) => Math.round(((n >> shift) & 255) * amt);
    return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
  }
  function gradeOf(score) {
    if (score == null || isNaN(score)) return null;
    if (score <= 0) return { grade: "-", label: "측정불가", c1: "#5c6070", c2: "#a3a8b6", dark: darken("#5c6070", 0.7) };
    const g = GRADES.find((x) => score >= x.min) || { grade: "D", c1: "#6d7384", c2: "#c3c8d4" };
    return Object.assign({ label: g.grade, dark: darken(g.c1, 0.7) }, g);
  }

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function fmt(key, v, opts = {}) {
    const m = STAT[key] || {};
    if (m.pct) return `${Number(v).toFixed(1)}%`;
    return opts.comma === false ? String(Math.round(v)) : Math.round(v).toLocaleString("en-US");
  }

  function rvOf(sub, rvStats) {
    const m = STAT[sub.key];
    if (!m || !m.maxRoll || !rvStats.includes(sub.key)) return 0;
    return (sub.value / m.maxRoll) * 100;
  }

  function tierColor(rv) {
    if (rv >= 600) return "#f5a623"; // gold
    if (rv >= 450) return "#c77df2"; // purple
    if (rv >= 300) return "#6f8fe0"; // blue
    return "#8a8f9c";                // gray
  }

  // seeded random so the stars don't jump on every re-render
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function paintBackground(canvas, element, seed) {
    const w = 980, h = 395, dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const g = canvas.getContext("2d");
    g.scale(dpr, dpr);
    const [c0, c1, c2] = ELEMENT_BG[element] || ELEMENT_BG.Electro;

    const lin = g.createLinearGradient(0, 0, 0, h);
    lin.addColorStop(0, c0);
    lin.addColorStop(0.55, c1);
    lin.addColorStop(1, c2);
    g.fillStyle = lin;
    g.fillRect(0, 0, w, h);

    const r = rng(seed);
    // soft nebula blobs
    for (let i = 0; i < 7; i++) {
      const x = r() * w, y = h * (0.3 + r() * 0.7), rad = 120 + r() * 220;
      const rg = g.createRadialGradient(x, y, 0, x, y, rad);
      rg.addColorStop(0, "rgba(255,255,255,0.07)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rg;
      g.fillRect(0, 0, w, h);
    }
    // dots
    for (let i = 0; i < 160; i++) {
      const x = r() * w, y = r() * h, s = r() * 1.3 + 0.3;
      g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.6})`;
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2);
      g.fill();
    }
    // a few sparkles
    for (let i = 0; i < 6; i++) {
      const x = r() * w, y = r() * h, s = 3 + r() * 4;
      g.strokeStyle = "rgba(255,255,255,0.8)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x - s, y); g.lineTo(x + s, y);
      g.moveTo(x, y - s); g.lineTo(x, y + s);
      g.stroke();
    }
  }



  // ---------- main ----------
  function renderBuildCard(container, data, options = {}) {
    const rvStats = options.rvStats || data.rvStats || ["FIGHT_PROP_CRITICAL", "FIGHT_PROP_CRITICAL_HURT", "FIGHT_PROP_ATTACK_PERCENT"];
    const scale = (options.width || 980) / 980;
    if (options.assetBase != null) ASSET_BASE = options.assetBase;

    // --- artifacts: RV, tiers, roll totals
    const totals = {}; // key -> { rolls, value }
    let cv = 0;
    const arts = (data.artifacts || []).map((a) => {
      let rv = 0;
      a.subs.forEach((s) => {
        rv += rvOf(s, rvStats);
        const t = (totals[s.key] = totals[s.key] || { rolls: 0, value: 0 });
        t.rolls += s.rolls || 0;
        t.value += s.value;
        if (s.key === "FIGHT_PROP_CRITICAL") cv += s.value * 2;
        if (s.key === "FIGHT_PROP_CRITICAL_HURT") cv += s.value;
      });
      if (a.main.key === "FIGHT_PROP_CRITICAL") cv += a.main.value * 2;
      if (a.main.key === "FIGHT_PROP_CRITICAL_HURT") cv += a.main.value;
      rv = Math.round(rv / 10) * 10;
      return { ...a, rv };
    });
    const totalRv = arts.reduce((n, a) => n + a.rv, 0);

    // --- html
    const cons = Array.from({ length: 6 }, (_, i) => {
      const src = (data.constellationIcons || [])[i];
      const locked = i >= (data.constellation || 0);
      return `<div class="ak-con${locked ? " locked" : ""}">${src ? `<img src="${esc(src)}" alt="">` : ""}</div>`;
    }).join("");

    const talents = (data.talents || []).map((t) => {
      const cls = t.boosted ? "boosted" : t.level >= 10 ? "max" : "";
      return `<div class="ak-talent"><div class="ic"><img src="${esc(t.icon)}" alt=""></div><div class="lv ${cls}">${t.level}</div></div>`;
    }).join("");

    const w = data.weapon || {};
    const weapon = `
      <div class="ak-weapon">
        <div class="wicon"><img src="${esc(w.icon)}" alt=""><div class="stars">${"★".repeat(w.rarity || 0)}</div></div>
        <div>
          <div class="wname">${esc(w.name)}</div>
          <div class="row">
            <span class="ak-chip">${icon("FIGHT_PROP_ATTACK")}${w.baseAtk}</span>
            ${w.sub ? `<span class="ak-chip">${icon(w.sub.key)}${fmt(w.sub.key, w.sub.value)}</span>` : ""}
          </div>
          <div class="row">
            <span class="ak-chip dark">R${w.refinement}</span>
            <span class="ak-chip dark">Lv. ${w.level}<i>/${w.maxLevel || 90}</i></span>
          </div>
        </div>
      </div>`;

    const stats = (data.stats || []).map((s) =>
      `<div class="ak-stat">${icon(s.key)}<span class="label">${esc(s.label || (STAT[s.key] || {}).ko || s.key)}</span><span class="val">${fmt(s.key, s.value, { comma: false })}</span></div>`
    ).join("");
    const sets = (data.sets || []).map((s) =>
      `<div class="ak-stat set">${(s.icon || s.setId) ? `<img class="set-ic" src="${esc(s.icon || `https://enka.network/ui/UI_RelicIcon_${s.setId}_4.png`)}" alt="">` : `<svg viewBox="0 0 24 24" fill="#9df29d"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg>`}<span class="label">${esc(s.name)}</span><span class="val">×${s.count}</span></div>`
    ).join("");

    const bgMap = Object.assign({}, DEFAULT_BACKGROUNDS, options.backgrounds || {});
    const bgSrc = bgMap[data.element] && ((options.backgrounds || {})[data.element] ? bgMap[data.element] : ASSET_BASE + bgMap[data.element]);
    const artCards = arts.map((a) => {
      const subs = a.subs.map((s) => {
        const rel = rvStats.includes(s.key);
        return `<div class="ak-sub">${icon(s.key)}<span class="v">${fmt(s.key, s.value)}</span></div>`;
      }).join("");
      return `
        <div class="ak-art-card">
          ${bgSrc ? `<div class="abg" style="background-image:url('${esc(bgSrc)}')"></div>` : `<div class="abg" style="background:${esc((ELEMENT_BG[data.element] || ELEMENT_BG.Electro)[1])}"></div>`}
          <img class="aicon" src="${esc(a.icon)}" alt="">
          <div class="main">${icon(a.main.key)}${fmt(a.main.key, a.main.value, { comma: false })}</div>
          <div class="subs">${subs}</div>
        </div>`;
    }).join("");


    // rating: a number you compute yourself (data.rating); grade badge + score underneath
    const g = gradeOf(data.rating);
    const ratingBlock = g
      ? `<div class="ak-rating" style="--g1:${g.c1};--g2:${g.c2};--g-dark:${g.dark}">
           <div class="gem-wrap">
             <div class="gem"></div>
             <div class="letter${g.grade.length > 1 ? " two" : ""}">${esc(g.grade)}</div>
           </div>
           <div class="score${data.rating <= 0 ? " na" : ""}">${data.rating <= 0 ? "측정불가" : `${Number(data.rating).toFixed(1)}<i>점</i>`}</div>
         </div>`
      : "";

    const wrap = document.createElement("div");
    wrap.className = "ak-wrap";
    wrap.style.setProperty("--ak-scale", scale);
    const elColor = ELEMENT_COLOR[data.element] || ELEMENT_COLOR.Electro;
    wrap.style.setProperty("--ak-el", elColor + "cc");
    wrap.style.setProperty("--ak-el-solid", elColor);
    wrap.style.setProperty("--ak-el-glow", elColor + "99");
    wrap.innerHTML = `
      <div class="ak-card">
        <div class="ak-bg">
          <canvas></canvas>
          <img class="ak-art" src="${esc(data.splash)}" alt="" style="object-position:${esc(options.artPosition || data.artPosition || "50% 30%")}">
          <div class="ak-art-shade"></div>
        </div>
        <div class="ak-name"><b>${esc(data.name)}</b></div>
        ${(data.nickname || data.uid) ? `<div class="ak-owner">${esc(data.nickname || "")}${data.nickname && data.uid ? '<span class="sep">·</span>' : ""}${data.uid ? `UID ${esc(data.uid)}` : ""}</div>` : ""}
        <div class="ak-level">Lv. ${data.level}<i>/${data.maxLevel || 90}</i></div>
        <div class="ak-friend">${friendIcon()}${data.friendship ?? ""}</div>
        <div class="ak-cons">${cons}</div>
        <div class="ak-talents">${talents}</div>
        ${weapon}
        <div class="ak-stats">${stats}${sets}</div>
        ${ratingBlock}
        <div class="ak-arts">${artCards}</div>
      </div>`;

    const seed = [...String(data.uid || "") + (data.name || "")].reduce((n, c) => n * 31 + c.charCodeAt(0), 7);
    const canvas = wrap.querySelector("canvas");
    if (bgSrc) {
      const img = document.createElement("img");
      img.className = "ak-bg-img";
      img.src = bgSrc;
      img.alt = "";
      canvas.replaceWith(img);
    } else {
      paintBackground(canvas, data.element, seed);
    }

    if (container) {
      container.innerHTML = "";
      container.appendChild(wrap);
    }
    return wrap;
  }

  global.GenshinCard = { renderBuildCard, countRolls, gradeOf, STAT };
})(window);

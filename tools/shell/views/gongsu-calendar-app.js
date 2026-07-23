import { navigate } from '../router.js?v=7';
const {
  useState,
  useEffect,
  useMemo,
  useRef
} = React;
const C = {
  extended: "#C97A1E",
  night: "#3B3A6B",
  early: "#2E6E8E",
  off: "#D9453A",
  sun: "#C1584C",
  sat: "#2E6E8E",
  teamRest: "#2F8F5B"
};
const THEME_OPTIONS = [
  { id: "cream", label: "크림", swatch: "#F6F4EF" },
  { id: "green", label: "연두", swatch: "#EAF3E3" },
  { id: "gray", label: "회색", swatch: "#E9E9EC" },
  { id: "white", label: "흰색", swatch: "#FFFFFF" },
  { id: "black", label: "검정", swatch: "#17181C" }
];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const EXPENSE_CATS = [{
  key: "transport",
  label: "교통"
}, {
  key: "lodging",
  label: "숙박"
}, {
  key: "material",
  label: "자재"
}, {
  key: "snack",
  label: "간식"
}, {
  key: "meal",
  label: "식비"
}, {
  key: "etc",
  label: "기타"
}];
const DEFAULT_CHIPS = [0.5, 1.0, 1.5];
const STORE_KEY = "gongsu:worker:v2";

/* -------- 2026년 기준 세금/4대보험 상수 (참고용, 매년 변경될 수 있음) -------- */
const DAILY_TAX_DEDUCTION = 150000; // 일용근로소득 1일 공제액
const INCOME_TAX_EFFECTIVE = 0.027; // 6% x (1-55% 세액공제)
const MIN_WITHHOLDING = 1000; // 소액부징수 기준
const LOCAL_TAX_RATE = 0.10; // 지방소득세 = 소득세의 10%
const PENSION_RATE = 0.0475; // 국민연금 근로자부담
const HEALTH_RATE = 0.03595; // 건강보험 근로자부담
const LTC_RATE_OF_HEALTH = 0.1314; // 장기요양보험료율 (건강보험료 대비)
const EMPLOYMENT_RATE = 0.009; // 고용보험 근로자부담
const PENSION_HEALTH_MIN_DAYS = 8; // 국민연금/건강보험 적용 최소 근무일(월)
const FREELANCE_TAX_RATE = 0.03; // 3.3% 사업소득 원천징수 중 소득세 3% (지방소득세 0.3%는 LOCAL_TAX_RATE로 계산)

const pad = n => String(n).padStart(2, "0");
const dateStr = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
// 대한민국 법정 공휴일 — 매년 갱신 필요. 2026년은 확인된 날짜, 2027년은 설날 연휴 범위 등
// 출처마다 조금씩 달라 추정치 포함(사용 전 재확인 권장). '이후 날짜 채우기' 기능의 휴일 제외용.
const KR_HOLIDAYS = new Set([
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-03-01", "2026-03-02",
  "2026-05-01", "2026-05-05", "2026-05-24", "2026-05-25", "2026-06-03", "2026-06-06",
  "2026-08-15", "2026-08-17", "2026-09-24", "2026-09-25", "2026-09-26",
  "2026-10-03", "2026-10-05", "2026-10-09", "2026-12-25",
  "2027-01-01", "2027-02-06", "2027-02-07", "2027-02-08", "2027-02-09", "2027-02-10",
  "2027-03-01", "2027-05-01", "2027-05-05", "2027-05-13", "2027-06-06",
  "2027-08-15", "2027-08-16", "2027-09-14", "2027-09-15", "2027-09-16",
  "2027-10-03", "2027-10-04", "2027-10-09", "2027-10-11", "2027-12-25", "2027-12-27"
]);
const isWorkableDay = ds => {
  const [y, m, d] = ds.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return wd !== 0 && wd !== 6 && !KR_HOLIDAYS.has(ds);
};
const won = n => Math.round(n || 0).toLocaleString("ko-KR") + "원";
const fmtG = g => {
  if (g === 0) return "0";
  const r = Math.round(g * 100) / 100;
  return Number.isInteger(r) ? r.toFixed(1) : String(r);
};
const chipValue = c => c && typeof c === "object" ? c.value : c;
const chipName = c => c && typeof c === "object" ? c.name : null;
const chipId = c => c && typeof c === "object" ? c.id : c;
const chipLabel = c => chipName(c) || fmtG(chipValue(c));

/* 1.0=주간, 1.0~2.0 미만=연장, 2.0 이상=야간, 0~1.0 미만=조퇴, 0=휴무 */
function typeOf(gongsu) {
  if (!gongsu || gongsu === 0) return "off";
  if (gongsu < 1.0) return "early";
  if (gongsu === 1.0) return "day";
  if (gongsu < 2.0) return "extended";
  return "night";
}
const TYPE_META = {
  day: {
    label: "주간",
    color: "var(--gg-ink)"
  },
  extended: {
    label: "연장",
    color: C.extended
  },
  night: {
    label: "야간",
    color: C.night
  },
  early: {
    label: "조퇴",
    color: C.early
  },
  off: {
    label: "휴무",
    color: C.off
  }
};
const isDefaultChip = v => DEFAULT_CHIPS.includes(v);
function defaultState() {
  return {
    defaultUnitPrice: 150000,
    defaultAllowance: 0,
    taxMode: "worker",
    customChips: [],
    theme: "cream",
    entries: {}
  };
}

/* ---- 일용근로소득세 (1일 단위 계산 후 합산) ---- */
function dailyIncomeTax(grossPay) {
  const taxable = grossPay - DAILY_TAX_DEDUCTION;
  if (taxable <= 0) return 0;
  let tax = Math.floor(taxable * INCOME_TAX_EFFECTIVE);
  if (tax < MIN_WITHHOLDING) return 0;
  return tax;
}

/* ---- 3.3% 사업소득 원천징수 (프리랜서 직접 지급용) ---- */
function freelanceIncomeTax(grossPay) {
  const tax = Math.floor(grossPay * FREELANCE_TAX_RATE);
  if (tax < MIN_WITHHOLDING) return 0;
  return tax;
}

/* ---- 기간 내 급여/세금/4대보험 종합 계산 ---- */
function computeSummary(entries, start, end, defaultUnitPrice, taxMode) {
  let totalGross = 0;
  let totalIncomeTax = 0;
  let totalAllowance = 0;
  const byType = {
    day: {
      count: 0,
      gongsu: 0
    },
    extended: {
      count: 0,
      gongsu: 0
    },
    night: {
      count: 0,
      gongsu: 0
    },
    early: {
      count: 0,
      gongsu: 0
    },
    off: {
      count: 0,
      gongsu: 0
    }
  };
  const monthGroups = {}; // 'YYYY-MM' -> { days, gross }
  const byExpenseCat = {};
  EXPENSE_CATS.forEach(cat => {
    byExpenseCat[cat.key] = 0;
  });
  let totalExpense = 0;

  Object.entries(entries).forEach(([date, e]) => {
    if (date < start || date > end) return;
    if (e.expenses) {
      Object.entries(e.expenses).forEach(([key, amount]) => {
        if (!amount) return;
        if (byExpenseCat[key] == null) byExpenseCat[key] = 0;
        byExpenseCat[key] += amount;
        totalExpense += amount;
      });
    }
    const g = e.gongsu || 0;
    if (g <= 0) return;
    totalAllowance += e.allowance || 0;
    const unitPrice = e.unitPrice != null ? e.unitPrice : defaultUnitPrice;
    const grossDay = g * unitPrice;
    totalGross += grossDay;
    totalIncomeTax += taxMode === "freelance33" ? freelanceIncomeTax(grossDay) : dailyIncomeTax(grossDay);
    const t = typeOf(g);
    byType[t].count += 1;
    byType[t].gongsu += g;
    const ym = date.slice(0, 7);
    if (!monthGroups[ym]) monthGroups[ym] = {
      days: 0,
      gross: 0
    };
    monthGroups[ym].days += 1;
    monthGroups[ym].gross += grossDay;
  });
  const localIncomeTax = Math.floor(totalIncomeTax * LOCAL_TAX_RATE);
  let pension = 0,
    health = 0,
    ltc = 0,
    employment = 0;
  if (taxMode !== "freelance33") {
    Object.values(monthGroups).forEach(mg => {
      employment += mg.gross * EMPLOYMENT_RATE;
      if (mg.days >= PENSION_HEALTH_MIN_DAYS) {
        pension += mg.gross * PENSION_RATE;
        const healthPart = mg.gross * HEALTH_RATE;
        health += healthPart;
        ltc += healthPart * LTC_RATE_OF_HEALTH;
      }
    });
  }
  pension = Math.floor(pension);
  health = Math.floor(health);
  ltc = Math.floor(ltc);
  employment = Math.floor(employment);
  const totalTax = totalIncomeTax + localIncomeTax;
  const totalInsurance = pension + health + ltc + employment;
  const netPay = totalGross - totalTax - totalInsurance + totalAllowance;
  return {
    totalGross,
    totalIncomeTax,
    localIncomeTax,
    pension,
    health,
    ltc,
    employment,
    totalTax,
    totalInsurance,
    totalAllowance,
    netPay,
    byType,
    byExpenseCat,
    totalExpense
  };
}
function App() {
  const [state, setState] = useState(null);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return {
      y: n.getFullYear(),
      m: n.getMonth()
    };
  });
  const [dayModal, setDayModal] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showChipEdit, setShowChipEdit] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showBulkPrice, setShowBulkPrice] = useState(false);
  const [showMyStats, setShowMyStats] = useState(false);
  const [showNetPay, setShowNetPay] = useState(true);
  // 게스트 데이터소실 경고 배너 — 세션(탭)마다 다시 보이게, 완전히 끄진 않음
  const [showGuestNotice, setShowGuestNotice] = useState(() => !!window.gcIsGuest && !sessionStorage.getItem("gc_guest_notice_dismissed"));
  const dismissGuestNotice = () => {
    sessionStorage.setItem("gc_guest_notice_dismissed", "1");
    setShowGuestNotice(false);
  };
  const closeOverlay = () => history.back();
  useEffect(() => {
    const onPop = () => {
      setDayModal(null);
      setShowSummary(false);
      setShowChipEdit(false);
      setShowTeam(false);
      setShowMenu(false);
      setShowBulkPrice(false);
      setShowMyStats(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const overlayKey = dayModal ? "day" : showMenu ? "menu" : showSummary ? "summary" : showChipEdit ? "settings" : showTeam ? "team" : showBulkPrice ? "bulkprice" : showMyStats ? "mystats" : null;
  const prevOverlayKey = useRef(null);
  useEffect(() => {
    const prev = prevOverlayKey.current;
    if (overlayKey && !prev) {
      history.pushState({
        gcOverlay: overlayKey
      }, "");
    } else if (overlayKey && prev && overlayKey !== prev) {
      history.replaceState({
        gcOverlay: overlayKey
      }, "");
    }
    prevOverlayKey.current = overlayKey;
  }, [overlayKey]);
  useEffect(() => {
    let alive = true;
    (async () => {
      let data = null;
      try {
        const res = await window.storage.get(STORE_KEY);
        if (res && res.value) data = JSON.parse(res.value);
      } catch (_) {
        data = null;
      }
      if (!alive) return;
      setState(data || defaultState());
    })();
    return () => {
      alive = false;
    };
  }, []);
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!state) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      window.storage.set(STORE_KEY, JSON.stringify(state)).catch(() => {});
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [state]);
  useEffect(() => {
    document.documentElement.setAttribute("data-gg-theme", (state && state.theme) || "cream");
  }, [state && state.theme]);
  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);
  const monthStats = useMemo(() => {
    if (!state) return null;
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    let gongsu = 0,
      pay = 0,
      workDays = 0;
    const byType = {
      day: {
        count: 0,
        gongsu: 0
      },
      extended: {
        count: 0,
        gongsu: 0
      },
      night: {
        count: 0,
        gongsu: 0
      },
      early: {
        count: 0,
        gongsu: 0
      },
      off: {
        count: 0,
        gongsu: 0
      }
    };
    // 커스텀 칩별 이번 달 집계 (칩 id -> { count: 사용 일수, gongsu: 공수 합계 })
    const byChip = {};
    (state.customChips || []).forEach(c => {
      byChip[chipId(c)] = {
        count: 0,
        gongsu: 0
      };
    });
    for (let d = 1; d <= daysInMonth; d++) {
      const e = state.entries[dateStr(cursor.y, cursor.m, d)];
      if (!e) continue;
      const g = e.gongsu || 0;
      if (g > 0) {
        gongsu += g;
        pay += g * (e.unitPrice == null ? state.defaultUnitPrice : e.unitPrice);
        byType[typeOf(g)].count += 1;
        byType[typeOf(g)].gongsu += g;
        workDays += 1;
        const chip = (state.customChips || []).find(c => chipValue(c) === g);
        if (chip) {
          byChip[chipId(chip)].count += 1;
          byChip[chipId(chip)].gongsu += g;
        }
      } else {
        byType.off.count += 1;
      }
    }
    const start = dateStr(cursor.y, cursor.m, 1);
    const end = dateStr(cursor.y, cursor.m, daysInMonth);
    const netPay = computeSummary(state.entries, start, end, state.defaultUnitPrice, state.taxMode).netPay;
    return {
      gongsu,
      pay,
      netPay,
      byType,
      byChip,
      workDays
    };
  }, [state, cursor]);
  const saveEntry = (date, patch) => {
    setState(prev => {
      const entries = {
        ...prev.entries
      };
      const cur = entries[date] || {
        gongsu: 0,
        unitPrice: prev.defaultUnitPrice,
        allowance: prev.defaultAllowance || 0,
        memo: "",
        expenses: {}
      };
      entries[date] = {
        ...cur,
        ...patch
      };
      return {
        ...prev,
        entries
      };
    });
  };
  const deleteEntry = date => {
    setState(prev => {
      const entries = {
        ...prev.entries
      };
      delete entries[date];
      return {
        ...prev,
        entries
      };
    });
  };
  const saveCustomChips = chips => setState(prev => ({
    ...prev,
    customChips: chips
  }));
  const saveDefaultPrice = p => setState(prev => ({
    ...prev,
    defaultUnitPrice: p
  }));
  const saveDefaultAllowance = a => setState(prev => ({
    ...prev,
    defaultAllowance: a
  }));
  const saveTaxMode = m => setState(prev => ({
    ...prev,
    taxMode: m
  }));
  const saveTheme = t => setState(prev => ({
    ...prev,
    theme: t
  }));
  const bulkUpdatePrice = (start, end, newPrice) => {
    const targetDates = Object.keys(state.entries).filter(date => date >= start && date <= end && state.entries[date].gongsu > 0);
    setState(prev => {
      const entries = { ...prev.entries };
      targetDates.forEach(date => {
        if (!entries[date]) return;
        entries[date] = { ...entries[date], unitPrice: newPrice };
      });
      return { ...prev, entries };
    });
    return targetDates.length;
  };
  // 선택한 날짜부터 그 달 말일까지, 주말/공휴일을 제외한 날에 같은 공수·단가를 채운다
  const fillToMonthEnd = (date, patch) => {
    const [y, m, startD] = date.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const targetDates = [];
    for (let d = startD; d <= lastDay; d++) {
      const ds = dateStr(y, m - 1, d);
      if (isWorkableDay(ds)) targetDates.push(ds);
    }
    setState(prev => {
      const entries = { ...prev.entries };
      targetDates.forEach(ds => {
        const cur = entries[ds] || {
          gongsu: 0,
          unitPrice: prev.defaultUnitPrice,
          allowance: prev.defaultAllowance || 0,
          memo: "",
          expenses: {}
        };
        entries[ds] = { ...cur, gongsu: patch.gongsu, unitPrice: patch.unitPrice };
      });
      return { ...prev, entries };
    });
    return targetDates.length;
  };
  const moveMonth = delta => setCursor(c => {
    const d = new Date(c.y, c.m + delta, 1);
    return {
      y: d.getFullYear(),
      m: d.getMonth()
    };
  });
  const goToday = () => {
    const n = new Date();
    setCursor({
      y: n.getFullYear(),
      m: n.getMonth()
    });
  };
  const todayStr = (() => {
    const n = new Date();
    return dateStr(n.getFullYear(), n.getMonth(), n.getDate());
  })();
  if (!state) {
    return React.createElement("div", {
      className: "gg-root gg-loading"
    }, React.createElement("div", null, React.createElement("div", {
      className: "gg-loading-title"
    }, "Feeder"), React.createElement("div", {
      className: "gg-loading-sub"
    }, "불러오는 중…")));
  }
  return React.createElement("div", {
    className: "gg-root"
  }, React.createElement("header", {
    className: "gg-top"
  }, React.createElement("button", {
    className: "gg-icon gg-icon-text gg-brand-btn",
    onClick: () => { navigate('home'); }
  }, "Feeder"), React.createElement("div", {
    className: "gg-monthnav"
  }, React.createElement("button", {
    className: "gg-navbtn",
    onClick: () => moveMonth(-1),
    "aria-label": "이전 달"
  }, "‹"), React.createElement("div", {
    className: "gg-monthlabel"
  }, React.createElement("span", {
    className: "gg-year"
  }, cursor.y), React.createElement("strong", null, cursor.m + 1 + "월")), React.createElement("button", {
    className: "gg-navbtn",
    onClick: () => moveMonth(1),
    "aria-label": "다음 달"
  }, "›")), React.createElement("button", {
    className: "gg-icon",
    onClick: () => setShowMenu(true),
    "aria-label": "메뉴"
  }, "☰")), React.createElement("div", {
    className: "gg-todaybar"
  }, React.createElement("button", {
    className: "gg-todaybtn",
    onClick: goToday
  }, "Today"), React.createElement("button", {
    className: "gg-icon gg-icon-text",
    onClick: () => setShowSummary(true)
  }, "명세서")), showGuestNotice && React.createElement("div", {
    className: "gg-guestnotice"
  }, React.createElement("span", null, "🔓 로그인 없이 이용 중이에요", React.createElement("br"), "이 기기에만 저장돼요"), React.createElement("div", {
    className: "gg-guestnotice-actions"
  }, React.createElement("button", {
    className: "gg-guestnotice-login",
    onClick: () => { location.href = "index.html?login=1"; }
  }, "로그인하기"), React.createElement("button", {
    className: "gg-guestnotice-close",
    onClick: dismissGuestNotice,
    "aria-label": "닫기"
  }, "✕"))), React.createElement("main", {
    className: "gg-main"
  }, React.createElement("div", {
    className: "gg-weekrow"
  }, WEEKDAYS.map((w, i) => React.createElement("div", {
    key: w,
    className: "gg-weekday",
    style: i === 0 ? { color: C.sun } : i === 6 ? { color: C.sat } : undefined
  }, w))), React.createElement("div", {
    className: "gg-grid"
  }, grid.map((d, idx) => {
    if (d === null) return React.createElement("div", {
      key: idx,
      className: "gg-cell gg-empty"
    });
    const ds = dateStr(cursor.y, cursor.m, d);
    const e = state.entries[ds];
    const wd = idx % 7;
    const isToday = ds === todayStr;
    const isTeamRest = !!(window.gcTeamRestDays && window.gcTeamRestDays[ds]);
    const workedOnRestDay = isTeamRest && e && e.gongsu > 0;
    const isHoliday = KR_HOLIDAYS.has(ds);
    const dayColor = isTeamRest ? C.teamRest : (wd === 0 || isHoliday ? C.sun : wd === 6 ? C.sat : undefined);
    const type = e ? typeOf(e.gongsu || 0) : null;
    const showLabel = workedOnRestDay || (!isTeamRest && type) || isTeamRest;
    const labelColor = workedOnRestDay ? TYPE_META[type].color : (isTeamRest ? C.teamRest : (type ? TYPE_META[type].color : undefined));
    const labelText = workedOnRestDay ? fmtG(e.gongsu) : (isTeamRest ? "휴무" : (type === "off" ? "휴무" : type ? fmtG(e.gongsu) : null));
    return React.createElement("button", {
      key: idx,
      className: "gg-cell" + (isToday ? " is-today" : ""),
      onClick: () => setDayModal({
        date: ds
      })
    }, React.createElement("span", {
      className: "gg-daynum",
      style: {
        color: dayColor
      }
    }, d), showLabel && React.createElement("span", {
      className: "gg-gongsu",
      style: {
        color: labelColor
      }
    }, labelText), React.createElement("span", {
      className: "gg-marks"
    }, e && e.memo && React.createElement("span", {
      className: "gg-mark gg-mark-memo"
    }), e && Object.values(e.expenses || {}).some(v => v > 0) && React.createElement("span", {
      className: "gg-mark gg-mark-exp"
    })));
  })), monthStats && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "gg-summary"
  }, React.createElement("div", {
    className: "gg-sumitem gg-sumpay"
  }, React.createElement("span", {
    className: "gg-sumpay-label"
  }, "이 달 예상 급여", React.createElement("div", {
    className: "gg-taxswitch",
    onClick: e => e.stopPropagation()
  }, React.createElement("button", {
    className: "gg-taxswitch-opt" + (showNetPay ? " is-active" : ""),
    onClick: () => setShowNetPay(true)
  }, "세후"), React.createElement("button", {
    className: "gg-taxswitch-opt" + (showNetPay ? "" : " is-active"),
    onClick: () => setShowNetPay(false)
  }, "세전"))), React.createElement("strong", null, won(showNetPay ? monthStats.netPay : monthStats.pay))), React.createElement("div", {
    className: "gg-sumitem"
  }, React.createElement("span", null, "총 공수"), React.createElement("strong", null, fmtG(monthStats.gongsu)), React.createElement("span", {
    className: "gg-sumitem-sub"
  }, "총 ", monthStats.workDays, "일"))), React.createElement("div", {
    className: "gg-typerow"
  }, Object.entries(TYPE_META).filter(([k]) => k !== "night").map(([k, meta]) => React.createElement("div", {
    key: k,
    className: "gg-typechip"
  }, React.createElement("span", {
    className: "gg-typedot",
    style: {
      background: meta.color
    }
  }), React.createElement("span", {
    className: "gg-typelabel"
  }, meta.label), React.createElement("strong", null, monthStats.byType[k].count + "일"), k !== "off" && React.createElement("span", {
    style: {
      fontSize: "11px",
      fontWeight: 700,
      color: "var(--gg-ink-faint)"
    }
  }, "· " + fmtG(monthStats.byType[k].gongsu)))), state.customChips.map(chip => {
    const t = typeOf(chipValue(chip));
    const stat = monthStats.byChip[chipId(chip)] || {
      count: 0,
      gongsu: 0
    };
    return React.createElement("div", {
      key: chipId(chip),
      className: "gg-typechip"
    }, React.createElement("span", {
      className: "gg-typedot",
      style: {
        background: TYPE_META[t].color
      }
    }), React.createElement("span", {
      className: "gg-typelabel"
    }, chipLabel(chip)), React.createElement("strong", null, stat.count + "일"), React.createElement("span", {
      style: {
        fontSize: "11px",
        fontWeight: 700,
        color: "var(--gg-ink-faint)"
      }
    }, "· " + fmtG(stat.gongsu)));
  })))), dayModal && React.createElement(DayModal, {
    date: dayModal.date,
    entry: state.entries[dayModal.date],
    customChips: state.customChips,
    defaultUnitPrice: state.defaultUnitPrice,
    defaultAllowance: state.defaultAllowance,
    isTeamRestDay: !!(window.gcTeamRestDays && window.gcTeamRestDays[dayModal.date]),
    isAdmin: !!window.gcIsAdmin,
    onClose: closeOverlay,
    onSave: (patch, fillRest) => {
      if (fillRest) fillToMonthEnd(dayModal.date, patch);
      else saveEntry(dayModal.date, patch);
      closeOverlay();
    },
    onDelete: () => {
      deleteEntry(dayModal.date);
      closeOverlay();
    }
  }), showSummary && React.createElement(SummaryModal, {
    state,
    initialY: cursor.y,
    initialM: cursor.m,
    onClose: closeOverlay
  }), showChipEdit && React.createElement(SettingsModal, {
    customChips: state.customChips,
    defaultUnitPrice: state.defaultUnitPrice,
    defaultAllowance: state.defaultAllowance,
    taxMode: state.taxMode,
    theme: state.theme || "cream",
    onClose: closeOverlay,
    onSaveChips: saveCustomChips,
    onSavePrice: saveDefaultPrice,
    onSaveAllowance: saveDefaultAllowance,
    onSaveTaxMode: saveTaxMode,
    onSaveTheme: saveTheme
  }), showMenu && React.createElement(Sidebar, {
    onClose: closeOverlay,
    onSettings: () => {
      setShowMenu(false);
      setShowChipEdit(true);
    },
    onTeam: () => {
      setShowMenu(false);
      setShowTeam(true);
    },
    onBulkPrice: () => {
      setShowMenu(false);
      setShowBulkPrice(true);
    },
    onMyStats: () => {
      setShowMenu(false);
      setShowMyStats(true);
    }
  }), showTeam && React.createElement(TeamModal, {
    onClose: closeOverlay
  }), showBulkPrice && React.createElement(BulkPriceModal, {
    entries: state.entries,
    initialY: cursor.y,
    initialM: cursor.m,
    defaultUnitPrice: state.defaultUnitPrice,
    onClose: closeOverlay,
    onApply: (start, end, price) => bulkUpdatePrice(start, end, price)
  }), showMyStats && React.createElement(MyStatsModal, {
    entries: state.entries,
    defaultUnitPrice: state.defaultUnitPrice,
    taxMode: state.taxMode,
    onClose: closeOverlay
  }));
}
function DayModal({
  date,
  entry,
  customChips,
  defaultUnitPrice,
  defaultAllowance,
  isTeamRestDay,
  isAdmin,
  onClose,
  onSave,
  onDelete
}) {
  const [tab, setTab] = useState("gongsu");
  const [gongsu, setGongsu] = useState(entry ? entry.gongsu : 0);
  const [unitPrice, setUnitPrice] = useState(entry && entry.unitPrice != null ? entry.unitPrice : defaultUnitPrice);
  const [allowance, setAllowance] = useState(entry && entry.allowance != null ? entry.allowance : (defaultAllowance || 0));
  const [memo, setMemo] = useState(entry && entry.memo || "");
  const [expenses, setExpenses] = useState(entry && entry.expenses || {});
  const [fillRest, setFillRest] = useState(false);
  const parts = date.split("-").map(Number);
  const y = parts[0],
    m = parts[1],
    d = parts[2];
  const wd = new Date(y, m - 1, d).getDay();
  const dateLabel = `${m}월 ${d}일 ${WEEKDAYS[wd]}요일`;
  const pay = gongsu * unitPrice;
  const type = typeOf(gongsu);
  const expenseTotal = Object.values(expenses).reduce((a, b) => a + (b || 0), 0);
  const allChips = useMemo(() => [...DEFAULT_CHIPS, ...customChips].sort((a, b) => chipValue(a) - chipValue(b)), [customChips]);
  const restricted = isTeamRestDay && !isAdmin;
  if (restricted) {
    return React.createElement("div", {
      className: "gg-overlay",
      onClick: onClose
    }, React.createElement("div", {
      className: "gg-sheet gg-sheet-full",
      onClick: e => e.stopPropagation()
    }, React.createElement("div", {
      className: "gg-sheet-grip"
    }), React.createElement("div", {
      className: "gg-sheet-head"
    }, React.createElement("div", {
      className: "gg-sheet-date"
    }, dateLabel), React.createElement("button", {
      className: "gg-x",
      onClick: onClose,
      "aria-label": "닫기"
    }, "✕")), React.createElement("div", {
      className: "gg-teamrest-banner"
    }, "🏖️ 팀 전체 휴무"), React.createElement("div", {
      className: "gg-field"
    }, React.createElement("label", null, "기타경비"), React.createElement("input", {
      className: "gg-input gg-expenseinput",
      type: "number",
      inputMode: "numeric",
      placeholder: "0",
      value: expenses.etc || "",
      onChange: e => setExpenses(prev => ({
        ...prev,
        etc: Number(e.target.value) || 0
      }))
    })), React.createElement("div", {
      className: "gg-field"
    }, React.createElement("label", null, "메모"), React.createElement("textarea", {
      className: "gg-input",
      rows: 2,
      placeholder: "작업 내용, 현장 등",
      value: memo,
      onChange: e => setMemo(e.target.value)
    })), React.createElement("div", {
      className: "gg-sheet-actions"
    }, React.createElement("button", {
      className: "gg-btn gg-btn-primary",
      style: {
        background: "var(--gg-accent)"
      },
      onClick: () => onSave({
        memo: memo.trim(),
        expenses
      }, false)
    }, "저장"))));
  }
  return React.createElement("div", {
    className: "gg-overlay",
    onClick: onClose
  }, React.createElement("div", {
    className: "gg-sheet gg-sheet-full",
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "gg-sheet-grip"
  }), React.createElement("div", {
    className: "gg-sheet-head"
  }, React.createElement("div", {
    className: "gg-sheet-date"
  }, dateLabel), React.createElement("button", {
    className: "gg-x",
    onClick: onClose,
    "aria-label": "닫기"
  }, "✕")), React.createElement("div", {
    className: "gg-tabs"
  }, React.createElement("button", {
    className: "gg-tab" + (tab === "gongsu" ? " is-on" : ""),
    onClick: () => setTab("gongsu")
  }, "공수/메모"), React.createElement("button", {
    className: "gg-tab" + (tab === "expense" ? " is-on" : ""),
    onClick: () => setTab("expense")
  }, "기타 경비 ", expenseTotal > 0 && React.createElement("span", {
    className: "gg-tabbadge"
  }, won(expenseTotal)))), tab === "gongsu" ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "공수단가"), React.createElement("div", {
    className: "gg-stepper"
  }, React.createElement("button", {
    onClick: () => setUnitPrice(v => Math.max(0, v - 10000))
  }, "−"), React.createElement("input", {
    className: "gg-stepval-price-input",
    type: "number",
    inputMode: "numeric",
    value: unitPrice,
    onChange: e => setUnitPrice(Math.max(0, Number(e.target.value) || 0))
  }), React.createElement("button", {
    onClick: () => setUnitPrice(v => v + 10000)
  }, "+"))), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "일비 (비과세)"), React.createElement("div", {
    className: "gg-stepper"
  }, React.createElement("button", {
    onClick: () => setAllowance(v => Math.max(0, v - 10000))
  }, "−"), React.createElement("input", {
    className: "gg-stepval-price-input",
    type: "number",
    inputMode: "numeric",
    value: allowance,
    onChange: e => setAllowance(Math.max(0, Number(e.target.value) || 0))
  }), React.createElement("button", {
    onClick: () => setAllowance(v => v + 10000)
  }, "+"))), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "공수", gongsu > 0 && React.createElement("span", {
    className: "gg-typebadge",
    style: {
      color: TYPE_META[type].color,
      borderColor: TYPE_META[type].color
    }
  }, TYPE_META[type].label)), React.createElement("div", {
    className: "gg-stepper"
  }, React.createElement("button", {
    onClick: () => setGongsu(v => Math.max(0, +(v - 0.25).toFixed(2)))
  }, "−"), React.createElement("span", {
    className: "gg-stepval"
  }, fmtG(gongsu)), React.createElement("button", {
    onClick: () => setGongsu(v => +(v + 0.25).toFixed(2))
  }, "+"), React.createElement("span", {
    className: "gg-steppay"
  }, "= " + won(pay))), React.createElement("div", {
    className: "gg-chips"
  }, React.createElement("button", {
    className: "gg-chip gg-chip-off" + (gongsu === 0 ? " is-on" : ""),
    style: gongsu === 0 ? {
      background: C.off,
      borderColor: C.off
    } : undefined,
    onClick: () => setGongsu(0)
  }, "휴무"), allChips.map(chip => {
    const g = chipValue(chip);
    const t = typeOf(g);
    const on = gongsu === g;
    return React.createElement("button", {
      key: chipId(chip),
      className: "gg-chip" + (on ? " is-on" : ""),
      style: on ? {
        background: TYPE_META[t].color,
        borderColor: TYPE_META[t].color
      } : {
        color: TYPE_META[t].color
      },
      onClick: () => setGongsu(g)
    }, chipLabel(chip));
  }))), React.createElement("label", {
    className: "gg-fillrest"
  }, React.createElement("input", {
    type: "checkbox",
    checked: fillRest,
    onChange: e => setFillRest(e.target.checked)
  }), "말일까지 채우기", React.createElement("span", {
    className: "gg-fillrest-hint"
  }, "주말·공휴일 제외")), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "메모"), React.createElement("textarea", {
    className: "gg-input",
    rows: 2,
    placeholder: "작업 내용, 현장 등",
    value: memo,
    onChange: e => setMemo(e.target.value)
  }))) : React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "경비 항목"), React.createElement("div", {
    className: "gg-expenselist"
  }, EXPENSE_CATS.map(cat => React.createElement("div", {
    key: cat.key,
    className: "gg-expenserow"
  }, React.createElement("span", null, cat.label), React.createElement("input", {
    className: "gg-input gg-expenseinput",
    type: "number",
    inputMode: "numeric",
    placeholder: "0",
    value: expenses[cat.key] || "",
    onChange: e => setExpenses(prev => ({
      ...prev,
      [cat.key]: Number(e.target.value) || 0
    }))
  })))), React.createElement("div", {
    className: "gg-expensetotal"
  }, React.createElement("span", null, "합계"), React.createElement("strong", null, won(expenseTotal)))), React.createElement("div", {
    className: "gg-sheet-actions"
  }, entry && React.createElement("button", {
    className: "gg-btn gg-btn-ghost",
    onClick: onDelete
  }, "삭제"), React.createElement("button", {
    className: "gg-btn gg-btn-primary",
    style: {
      background: "var(--gg-accent)"
    },
    onClick: () => onSave({
      gongsu,
      unitPrice,
      allowance,
      memo: memo.trim(),
      expenses
    }, fillRest)
  }, "저장"))));
}
function SummaryModal({
  state,
  initialY,
  initialM,
  onClose
}) {
  const monthStart = dateStr(initialY, initialM, 1);
  const monthEnd = dateStr(initialY, initialM, new Date(initialY, initialM + 1, 0).getDate());
  const [start, setStart] = useState(monthStart);
  const [end, setEnd] = useState(monthEnd);
  const [tab, setTab] = useState("pay");
  const r = useMemo(() => computeSummary(state.entries, start, end, state.defaultUnitPrice, state.taxMode), [state, start, end]);
  const isFreelance = state.taxMode === "freelance33";
  return React.createElement("div", {
    className: "gg-overlay",
    onClick: onClose
  }, React.createElement("div", {
    className: "gg-sheet gg-sheet-tall",
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "gg-sheet-grip"
  }), React.createElement("div", {
    className: "gg-sheet-head"
  }, React.createElement("div", {
    className: "gg-sheet-date"
  }, "기간별 요약"), React.createElement("button", {
    className: "gg-x",
    onClick: onClose,
    "aria-label": "닫기"
  }, "✕")), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "기간"), React.createElement("div", {
    className: "gg-daterange"
  }, React.createElement("input", {
    className: "gg-input",
    type: "date",
    value: start,
    onChange: e => setStart(e.target.value)
  }), React.createElement("span", null, "~"), React.createElement("input", {
    className: "gg-input",
    type: "date",
    value: end,
    onChange: e => setEnd(e.target.value)
  }))), React.createElement("div", {
    className: "gg-tabs"
  }, React.createElement("button", {
    className: "gg-tab" + (tab === "pay" ? " is-on" : ""),
    onClick: () => setTab("pay")
  }, "급여 요약"), React.createElement("button", {
    className: "gg-tab" + (tab === "expense" ? " is-on" : ""),
    onClick: () => setTab("expense")
  }, "기타 경비", r.totalExpense > 0 && React.createElement("span", {
    className: "gg-tabbadge"
  }, won(r.totalExpense)))), tab === "pay" ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "총 지급액 (세전)"), React.createElement("div", {
    className: "gg-bigpay"
  }, won(r.totalGross))), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "공제 내역"), React.createElement("div", {
    className: "gg-deductlist"
  }, React.createElement("div", {
    className: "gg-deductrow"
  }, React.createElement("span", null, isFreelance ? "소득세 (3%)" : "소득세"), React.createElement("strong", null, won(r.totalIncomeTax))), React.createElement("div", {
    className: "gg-deductrow"
  }, React.createElement("span", null, "지방소득세"), React.createElement("strong", null, won(r.localIncomeTax))), !isFreelance && React.createElement("div", {
    className: "gg-deductrow"
  }, React.createElement("span", null, "국민연금"), React.createElement("strong", null, won(r.pension))), !isFreelance && React.createElement("div", {
    className: "gg-deductrow"
  }, React.createElement("span", null, "건강보험"), React.createElement("strong", null, won(r.health))), !isFreelance && React.createElement("div", {
    className: "gg-deductrow"
  }, React.createElement("span", null, "장기요양보험"), React.createElement("strong", null, won(r.ltc))), !isFreelance && React.createElement("div", {
    className: "gg-deductrow"
  }, React.createElement("span", null, "고용보험"), React.createElement("strong", null, won(r.employment)))), React.createElement("div", {
    className: "gg-deducttotal"
  }, React.createElement("span", null, "공제 합계"), React.createElement("strong", null, won(r.totalTax + r.totalInsurance)))), r.totalAllowance > 0 && React.createElement("div", {
    className: "gg-field"
  }, React.createElement("div", {
    className: "gg-deductrow"
  }, React.createElement("span", null, "일비 (비과세)"), React.createElement("strong", null, "+" + won(r.totalAllowance)))), React.createElement("div", {
    className: "gg-netpaybox"
  }, React.createElement("span", null, "실수령액"), React.createElement("strong", null, won(r.netPay))), React.createElement("p", {
    className: "gg-hint"
  }, isFreelance ? "3.3% 사업소득 원천징수 기준(소득세 3%+지방소득세 0.3%)이며 4대보험은 적용되지 않습니다. 참고용 추정치이니 실제 금액은 다를 수 있습니다." : "국민연금·건강보험은 해당 월에 8일 이상 근무해야 적용됩니다. 세금·보험료는 참고용 추정치이며 실제 금액은 다를 수 있습니다.")) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "기타경비 내역"), React.createElement("div", {
    className: "gg-receipt"
  }, r.totalExpense > 0 ? React.createElement(React.Fragment, null, EXPENSE_CATS.filter(cat => r.byExpenseCat[cat.key] > 0).map(cat => React.createElement("div", {
    key: cat.key,
    className: "gg-receipt-row"
  }, React.createElement("span", null, cat.label), React.createElement("strong", null, won(r.byExpenseCat[cat.key])))), React.createElement("div", {
    className: "gg-receipt-divider"
  }), React.createElement("div", {
    className: "gg-receipt-total"
  }, React.createElement("span", null, "경비 합계"), React.createElement("strong", null, won(r.totalExpense)))) : React.createElement("div", {
    className: "gg-receipt-empty"
  }, "이 기간에 등록된 기타경비가 없습니다"))), r.totalExpense > 0 && React.createElement("div", {
    className: "gg-field"
  }, React.createElement("div", {
    className: "gg-receipt gg-receipt-final"
  }, React.createElement("div", {
    className: "gg-receipt-row"
  }, React.createElement("span", null, "실수령액"), React.createElement("strong", null, won(r.netPay))), React.createElement("div", {
    className: "gg-receipt-row"
  }, React.createElement("span", null, "- 기타경비"), React.createElement("strong", null, won(r.totalExpense))), React.createElement("div", {
    className: "gg-receipt-divider"
  }), React.createElement("div", {
    className: "gg-receipt-total"
  }, React.createElement("span", null, "차감 후 금액"), React.createElement("strong", null, won(r.netPay - r.totalExpense))))), React.createElement("p", {
    className: "gg-hint"
  }, "기타경비는 실수령액 계산에는 포함되지 않은 참고용 정보입니다. 위 차감 후 금액은 실수령액에서 기타경비를 단순히 뺀 참고용 수치일 뿐, 실제 정산액은 아닙니다."))));
}
function SettingsModal({
  customChips,
  defaultUnitPrice,
  defaultAllowance,
  taxMode: taxModeProp,
  theme,
  onClose,
  onSaveChips,
  onSavePrice,
  onSaveAllowance,
  onSaveTaxMode,
  onSaveTheme
}) {
  const [chips, setChips] = useState(customChips);
  const [price, setPrice] = useState(defaultUnitPrice);
  const [allowance, setAllowance] = useState(defaultAllowance || 0);
  const [taxMode, setTaxMode] = useState(taxModeProp || "worker");
  const [newChip, setNewChip] = useState("");
  const [newChipName, setNewChipName] = useState("");
  const addChip = () => {
    const v = parseFloat(newChip);
    if (!v || v <= 0 || isDefaultChip(v) || chips.some(c => chipValue(c) === v)) return;
    const next = [...chips, {
      id: "c" + Date.now(),
      value: v,
      name: newChipName.trim() || null
    }].sort((a, b) => chipValue(a) - chipValue(b));
    setChips(next);
    onSaveChips(next);
    setNewChip("");
    setNewChipName("");
  };
  const removeChip = id => setChips(prev => {
    const next = prev.filter(c => chipId(c) !== id);
    onSaveChips(next);
    return next;
  });
  return React.createElement("div", {
    className: "gg-overlay",
    onClick: onClose
  }, React.createElement("div", {
    className: "gg-sheet",
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "gg-sheet-grip"
  }), React.createElement("div", {
    className: "gg-sheet-head"
  }, React.createElement("div", {
    className: "gg-sheet-date"
  }, "설정"), React.createElement("button", {
    className: "gg-x",
    onClick: onClose,
    "aria-label": "닫기"
  }, "✕")), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "기본 공수단가"), React.createElement("input", {
    className: "gg-input",
    type: "number",
    inputMode: "numeric",
    value: price,
    onChange: e => setPrice(Number(e.target.value) || 0)
  })), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "기본 일비 (비과세)"), React.createElement("input", {
    className: "gg-input",
    type: "number",
    inputMode: "numeric",
    value: allowance,
    onChange: e => setAllowance(Number(e.target.value) || 0)
  }), React.createElement("p", {
    className: "gg-hint"
  }, "근무일 입력 시 자동으로 채워지는 기본값입니다. 날짜별로 개별 수정할 수 있어요.")), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "정산 방식"), React.createElement("div", {
    className: "gg-taxmode"
  }, React.createElement("button", {
    type: "button",
    className: "gg-taxmode-btn" + (taxMode === "worker" ? " is-on" : ""),
    onClick: () => setTaxMode("worker")
  }, "일용근로 (4대보험)"), React.createElement("button", {
    type: "button",
    className: "gg-taxmode-btn" + (taxMode === "freelance33" ? " is-on" : ""),
    onClick: () => setTaxMode("freelance33")
  }, "3.3% 사업소득")), React.createElement("p", {
    className: "gg-hint"
  }, "3.3%는 팀장이 팀원에게 프리랜서(사업소득) 방식으로 직접 지급할 때만 선택하세요. 4대보험이 전부 빠지고 소득세 3%+지방소득세 0.3%만 적용됩니다.")), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "기본 칩 (고정, 수정 불가)"), React.createElement("div", {
    className: "gg-chipedit"
  }, DEFAULT_CHIPS.map(v => {
    const t = typeOf(v);
    return React.createElement("span", {
      key: v,
      className: "gg-chipedititem gg-chipedititem-locked",
      style: {
        color: TYPE_META[t].color,
        borderColor: TYPE_META[t].color
      }
    }, fmtG(v));
  }))), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "커스텀 칩"), chips.length > 0 && React.createElement("div", {
    className: "gg-chipedit"
  }, chips.map(chip => {
    const v = chipValue(chip);
    const t = typeOf(v);
    const label = chipName(chip) ? chipName(chip) + " (" + fmtG(v) + ")" : fmtG(v);
    return React.createElement("span", {
      key: chipId(chip),
      className: "gg-chipedititem",
      style: {
        color: TYPE_META[t].color,
        borderColor: TYPE_META[t].color
      }
    }, label, React.createElement("button", {
      onClick: () => removeChip(chipId(chip)),
      "aria-label": label + " 삭제"
    }, "✕"));
  })), React.createElement("div", {
    className: "gg-chipadd"
  }, React.createElement("input", {
    className: "gg-input gg-chipadd-value",
    type: "number",
    step: "0.05",
    placeholder: "값 (예: 0.25)",
    value: newChip,
    onChange: e => setNewChip(e.target.value)
  }), React.createElement("input", {
    className: "gg-input",
    type: "text",
    placeholder: "이름 (선택)",
    value: newChipName,
    onChange: e => setNewChipName(e.target.value)
  }), React.createElement("button", {
    className: "gg-btn gg-btn-ghost",
    onClick: addChip
  }, "추가")), React.createElement("p", {
    className: "gg-hint"
  }, "1.0=주간 · 1.0~2.0 미만=연장 · 2.0 이상=야간 · 1.0 미만=조퇴 로 자동 분류됩니다")), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "테마 색상"), React.createElement("div", {
    className: "gg-themeswatches"
  }, THEME_OPTIONS.map(t => React.createElement("button", {
    key: t.id,
    type: "button",
    className: "gg-themeswatch" + (theme === t.id ? " is-on" : ""),
    onClick: () => onSaveTheme(t.id)
  }, React.createElement("span", {
    className: "gg-themeswatch-dot",
    style: {
      background: t.swatch
    }
  }), React.createElement("span", null, t.label))))), React.createElement("div", {
    className: "gg-sheet-actions"
  }, React.createElement("button", {
    className: "gg-btn gg-btn-primary",
    style: {
      background: "var(--gg-accent)"
    },
    onClick: () => {
      onSaveChips(chips);
      onSavePrice(price);
      onSaveAllowance(allowance);
      onSaveTaxMode(taxMode);
      onClose();
    }
  }, "저장"))));
}
function Sidebar({
  onClose,
  onSettings,
  onTeam,
  onBulkPrice,
  onMyStats
}) {
  return React.createElement("div", {
    className: "gg-overlay gg-sidesheet-overlay",
    onClick: onClose
  }, React.createElement("div", {
    className: "gg-sidesheet",
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "gg-sidesheet-head"
  }, React.createElement("button", {
    className: "gg-sidesheet-brand",
    onClick: () => { location.href = "https://praiselab.net/tools/"; }
  }, "Feeder"), React.createElement("button", {
    className: "gg-x",
    onClick: onClose,
    "aria-label": "닫기"
  }, "✕")), React.createElement("button", {
    className: "gg-menuitem",
    onClick: onSettings
  }, React.createElement("span", {
    className: "gg-menuitem-icon"
  }, "⚙️"), React.createElement("span", null, "설정")), React.createElement("button", {
    className: "gg-menuitem",
    onClick: onMyStats
  }, React.createElement("span", {
    className: "gg-menuitem-icon"
  }, "📊"), React.createElement("span", null, "나의 공수 현황")), React.createElement("button", {
    className: "gg-menuitem",
    onClick: onTeam
  }, React.createElement("span", {
    className: "gg-menuitem-icon"
  }, "👥"), React.createElement("span", null, "공수 랭킹")), React.createElement("button", {
    className: "gg-menuitem",
    onClick: onBulkPrice
  }, React.createElement("span", {
    className: "gg-menuitem-icon"
  }, "💰"), React.createElement("span", null, "단가 일괄변경")), React.createElement("button", {
    className: "gg-menuitem",
    style: { marginTop: "auto" },
    onClick: () => { onClose(); if (window.gcIsGuest) { location.href = "index.html?login=1"; } else { gcLogout(); } }
  }, React.createElement("span", {
    className: "gg-menuitem-icon"
  }, window.gcIsGuest ? "🔑" : "🚪"), React.createElement("span", null, window.gcIsGuest ? "로그인 / 회원가입" : "로그아웃"))));
}
function MyStatsModal({
  entries,
  defaultUnitPrice,
  taxMode,
  onClose
}) {
  const months = useMemo(() => {
    const now = new Date();
    const list = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear(), m = d.getMonth();
      const start = dateStr(y, m, 1);
      const end = dateStr(y, m, new Date(y, m + 1, 0).getDate());
      let gongsu = 0;
      Object.entries(entries).forEach(([date, e]) => {
        if (date >= start && date <= end) gongsu += e.gongsu || 0;
      });
      const netPay = computeSummary(entries, start, end, defaultUnitPrice, taxMode).netPay;
      list.push({ label: `${m + 1}월`, ym: `${y}-${String(m + 1).padStart(2, "0")}`, gongsu, netPay });
    }
    return list;
  }, [entries, defaultUnitPrice, taxMode]);
  const workedMonths = months.filter(m => m.gongsu > 0);
  const avgGongsu = workedMonths.length ? workedMonths.reduce((a, m) => a + m.gongsu, 0) / workedMonths.length : 0;
  const thisMonth = months[months.length - 1];
  const maxVal = Math.max(1, ...months.map(m => m.gongsu));
  return React.createElement("div", {
    className: "gg-fullscreen"
  }, React.createElement("div", {
    className: "gg-fullscreen-head"
  }, React.createElement("button", {
    className: "gg-x",
    onClick: onClose,
    "aria-label": "닫기"
  }, "✕"), React.createElement("div", {
    className: "gg-fullscreen-title"
  }, "나의 공수 현황")), React.createElement("div", {
    className: "gg-fullscreen-body"
  }, React.createElement("div", {
    className: "gg-mystats-kpis"
  }, React.createElement("div", {
    className: "gg-mystats-kpi"
  }, React.createElement("span", null, "이번달 총공수"), React.createElement("strong", null, fmtG(thisMonth.gongsu))), React.createElement("div", {
    className: "gg-mystats-kpi"
  }, React.createElement("span", null, "최근 6개월 평균 공수"), React.createElement("strong", null, fmtG(avgGongsu))), React.createElement("div", {
    className: "gg-mystats-kpi"
  }, React.createElement("span", null, "이번달 예상 실수령액"), React.createElement("strong", null, won(thisMonth.netPay)))), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "월별 공수"), React.createElement("div", {
    className: "gg-teamrank-list"
  }, months.every(m => m.gongsu === 0) ? React.createElement("div", {
    className: "gg-teamrank-empty"
  }, "최근 6개월간 입력된 공수가 없습니다.") : months.map(m => React.createElement("div", {
    key: m.ym,
    className: "gg-teamrank-row"
  }, React.createElement("div", {
    className: "gg-teamrank-top"
  }, React.createElement("span", {
    className: "gg-teamrank-name"
  }, m.label), React.createElement("span", {
    className: "gg-teamrank-value"
  }, fmtG(m.gongsu))), React.createElement("div", {
    className: "gg-teamrank-track"
  }, React.createElement("div", {
    className: "gg-teamrank-fill",
    style: {
      width: m.gongsu / maxVal * 100 + "%"
    }
  }))))))));
}
function BulkPriceModal({
  entries,
  initialY,
  initialM,
  defaultUnitPrice,
  onClose,
  onApply
}) {
  const monthStart = dateStr(initialY, initialM, 1);
  const monthEnd = dateStr(initialY, initialM, new Date(initialY, initialM + 1, 0).getDate());
  const [start, setStart] = useState(monthStart);
  const [end, setEnd] = useState(monthEnd);
  const [price, setPrice] = useState(defaultUnitPrice);
  const targetCount = useMemo(() => Object.keys(entries).filter(d => d >= start && d <= end && entries[d].gongsu > 0).length, [entries, start, end]);
  const apply = () => {
    if (!(price > 0)) return;
    if (targetCount === 0) {
      alert("선택한 기간에 공수가 입력된 날짜가 없습니다.");
      return;
    }
    if (!confirm(`${start} ~ ${end} 기간에 기록된 ${targetCount}일의 단가를 ${won(price)}으로 변경할까요?`)) return;
    onApply(start, end, price);
    onClose();
  };
  return React.createElement("div", {
    className: "gg-overlay",
    onClick: onClose
  }, React.createElement("div", {
    className: "gg-sheet",
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "gg-sheet-grip"
  }), React.createElement("div", {
    className: "gg-sheet-head"
  }, React.createElement("div", {
    className: "gg-sheet-date"
  }, "단가 일괄변경"), React.createElement("button", {
    className: "gg-x",
    onClick: onClose,
    "aria-label": "닫기"
  }, "✕")), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "기간"), React.createElement("div", {
    className: "gg-daterange"
  }, React.createElement("input", {
    className: "gg-input",
    type: "date",
    value: start,
    onChange: e => setStart(e.target.value)
  }), React.createElement("span", null, "~"), React.createElement("input", {
    className: "gg-input",
    type: "date",
    value: end,
    onChange: e => setEnd(e.target.value)
  }))), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "새 단가"), React.createElement("div", {
    className: "gg-stepper"
  }, React.createElement("button", {
    onClick: () => setPrice(v => Math.max(0, v - 10000))
  }, "−"), React.createElement("input", {
    className: "gg-stepval-price-input",
    type: "number",
    inputMode: "numeric",
    value: price,
    onChange: e => setPrice(Math.max(0, Number(e.target.value) || 0))
  }), React.createElement("button", {
    onClick: () => setPrice(v => v + 10000)
  }, "+"))), React.createElement("p", {
    className: "gg-hint"
  }, `이 기간에 공수가 입력된 날짜 ${targetCount}일의 단가가 한번에 바뀝니다.`), React.createElement("div", {
    className: "gg-sheet-actions"
  }, React.createElement("button", {
    className: "gg-btn gg-btn-primary",
    style: {
      background: "var(--gg-accent)"
    },
    onClick: apply
  }, "적용"))));
}
const RANK_MEDALS = ["🥇", "🥈", "🥉"];
function teamRangePreset(kind) {
  const now = new Date();
  if (kind === "lastMonth") {
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    return [dateStr(y, m, 1), dateStr(y, m, new Date(y, m + 1, 0).getDate())];
  }
  if (kind === "all") return ["0001-01-01", "9999-12-31"];
  return [dateStr(now.getFullYear(), now.getMonth(), 1), dateStr(now.getFullYear(), now.getMonth(), new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())];
}
function TeamModal({
  onClose
}) {
  const [start, setStart] = useState(() => teamRangePreset("month")[0]);
  const [end, setEnd] = useState(() => teamRangePreset("month")[1]);
  const [members, setMembers] = useState(null);
  useEffect(() => {
    if (!window.gcMyTeamCode) { setMembers([]); return; }
    const unsub = window.colGongsuLeaderboard.where('teamCode', '==', window.gcMyTeamCode).onSnapshot(snap => {
      setMembers(snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })));
    }, () => setMembers([]));
    return unsub;
  }, []);
  const applyPreset = kind => {
    const [s, e] = teamRangePreset(kind);
    setStart(s);
    setEnd(e);
  };
  const ranked = useMemo(() => {
    if (!members) return [];
    const totals = members.map(m => {
      let sum = 0;
      Object.entries(m.gongsuByDate || {}).forEach(([date, g]) => {
        if (date >= start && date <= end) sum += g || 0;
      });
      return {
        id: m.id,
        name: m.name || "이름 없음",
        total: sum
      };
    });
    const sorted = totals.sort((a, b) => b.total - a.total);
    let rank = 0;
    sorted.forEach((m, i) => {
      if (i === 0 || m.total !== sorted[i - 1].total) rank += 1;
      m.rank = rank;
    });
    return sorted;
  }, [members, start, end]);
  const maxVal = Math.max(1, ...ranked.map(m => m.total));
  const groups = [];
  ranked.forEach(m => {
    const last = groups[groups.length - 1];
    if (last && last.rank === m.rank) {
      last.items.push(m);
    } else {
      groups.push({ rank: m.rank, total: m.total, items: [m] });
    }
  });
  const rows = window.gcIsGuest ? React.createElement("div", {
    className: "gg-teamrank-empty"
  }, "로그인하면 팀원과 공수 랭킹을 비교할 수 있어요") : members === null ? React.createElement("div", {
    className: "gg-teamrank-empty"
  }, "불러오는 중…") : ranked.length === 0 ? React.createElement("div", {
    className: "gg-teamrank-empty"
  }, "이 기간에 입력된 팀원 공수가 없습니다.") : groups.map(g => {
    const isMe = g.items.some(m => m.id === window.gcMyUid);
    return React.createElement("div", {
      key: g.rank,
      className: "gg-teamrank-row" + (isMe ? " gg-teamrank-row-me" : "")
    }, React.createElement("div", {
      className: "gg-teamrank-top"
    }, React.createElement("span", {
      className: "gg-teamrank-rank"
    }, RANK_MEDALS[g.rank - 1] || g.rank), React.createElement("span", {
      className: "gg-teamrank-name"
    }, g.items.map(m => m.name).join(", "), isMe && React.createElement("span", {
      className: "gg-teamrank-me-badge"
    }, "나")), React.createElement("span", {
      className: "gg-teamrank-value"
    }, fmtG(g.total))), React.createElement("div", {
      className: "gg-teamrank-track"
    }, React.createElement("div", {
      className: "gg-teamrank-fill",
      style: {
        width: g.total / maxVal * 100 + "%"
      }
    })));
  });
  return React.createElement("div", {
    className: "gg-fullscreen"
  }, React.createElement("div", {
    className: "gg-fullscreen-head"
  }, React.createElement("button", {
    className: "gg-x",
    onClick: onClose,
    "aria-label": "닫기"
  }, "✕"), React.createElement("div", {
    className: "gg-fullscreen-title"
  }, "공수 랭킹")), React.createElement("div", {
    className: "gg-fullscreen-body"
  }, React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "기간"), React.createElement("div", {
    className: "gg-teampresets"
  }, React.createElement("button", {
    className: "gg-teampreset-btn",
    onClick: () => applyPreset("month")
  }, "이번달"), React.createElement("button", {
    className: "gg-teampreset-btn",
    onClick: () => applyPreset("lastMonth")
  }, "지난달"), React.createElement("button", {
    className: "gg-teampreset-btn",
    onClick: () => applyPreset("all")
  }, "전체")), React.createElement("div", {
    className: "gg-daterange"
  }, React.createElement("input", {
    className: "gg-input",
    type: "date",
    value: start,
    onChange: e => setStart(e.target.value)
  }), React.createElement("span", null, "~"), React.createElement("input", {
    className: "gg-input",
    type: "date",
    value: end,
    onChange: e => setEnd(e.target.value)
  }))), React.createElement("div", {
    className: "gg-field"
  }, React.createElement("label", null, "팀원 순위"), React.createElement("div", {
    className: "gg-teamrank-list"
  }, rows))));
}
export { App };

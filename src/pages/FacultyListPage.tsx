import axios from "axios";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import srmLogo from "../assets/srmist-logo.png";
import UserMenu from "../components/UserMenu";
import "../components/SharedPageStyles.css";
import "../components/FacultyListPage.css";
import { useAuth } from "../contexts/AuthContext";
import { useFacultyListFilters } from "./useFacultyListFilters";

// ── Single global type alias — no duplicates ─────────────────────────────────
type RGB = [number, number, number];

interface Faculty {
  scopus_ids?: string[];
  name: string;
  department?: string;
  docs_count: number;
  timeframe_docs: number;
  access: string;
  faculty_id: string;
  docs_in_timeframe?: number;
  sdg?: string;
  domain?: string;
}

interface PaperRecord {
  doi: string;
  title: string;
  publication: string;
  type: string;
  year: number | string;
  ieee_format: string;
}

// ── PDF colour palette (module-level so all helpers share it) ─────────────────
const PDF_C: Record<string, RGB> = {
  navy:   [12,  35,  80],
  blue:   [30,  90,  180],
  teal:   [0,   115, 115],
  white:  [255, 255, 255],
  lgray:  [180, 185, 200],
  silver: [245, 246, 250],
  mid:    [90,  95,  115],
  dark:   [25,  25,  45],
  ice:    [232, 238, 252],
  green:  [25,  110, 55],
  red:    [170, 40,  40],
};

// ── Helpers that do NOT depend on component state ─────────────────────────────
function pdfTruncate(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + "…") > maxW) t = t.slice(0, -1);
  return t + "…";
}

function drawPDFFooter(
  doc: jsPDF, pageNum: number, totalPages: number,
  pageW: number, pageH: number, ML: number, MR: number,
  FOOTER_H: number, label: string
) {
  doc.setFillColor(...PDF_C.navy);
  doc.rect(0, pageH - FOOTER_H, pageW, FOOTER_H, "F");
  doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_C.lgray);
  doc.text(
    `SRM Institute of Science and Technology  —  ${label}  —  Confidential`,
    ML, pageH - 3.8
  );
  doc.text(`Page ${pageNum} of ${totalPages}`, pageW - MR, pageH - 3.8, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

function drawPDFPageHeader(
  doc: jsPDF, pageW: number, ML: number, MR: number, label: string
) {
  doc.setFillColor(...PDF_C.navy);
  doc.rect(0, 0, pageW, 14, "F");
  doc.setFillColor(...PDF_C.blue);
  doc.rect(0, 14, pageW, 0.8, "F");
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_C.white);
  doc.text(label, ML, 9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_C.lgray);
  doc.text("SRM SP Analytics", pageW - MR, 9, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

function drawPDFCoverPage(
  doc: jsPDF,
  pageW: number, pageH: number, ML: number, MR: number,
  cW: number, FOOTER_H: number,
  title: string, subtitle: string,
  activeFilters: string[],
  metrics: { label: string; value: string; color: RGB }[]
) {
  doc.setFillColor(...PDF_C.navy);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(...PDF_C.blue);
  doc.rect(0, 0, pageW, 3, "F");
  doc.setFillColor(20, 55, 130);
  doc.rect(pageW - 48, 0, 48, 48, "F");
  doc.setFillColor(...PDF_C.blue);
  doc.rect(pageW - 48, 0, 3, 48, "F");

  doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_C.lgray);
  doc.text("SRM INSTITUTE OF SCIENCE AND TECHNOLOGY", pageW / 2, 18, { align: "center" });
  doc.setDrawColor(...PDF_C.blue); doc.setLineWidth(0.5);
  doc.line(ML + 25, 21, pageW - MR - 25, 21);
  doc.setFontSize(20); doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_C.white);
  doc.text(title, pageW / 2, 32, { align: "center" });
  doc.setFontSize(11);
  doc.setTextColor(140, 175, 240);
  doc.text(subtitle, pageW / 2, 41, { align: "center" });

  // Filters box
  const filterRows = activeFilters.length === 0 ? 1 : Math.ceil(activeFilters.length / 2);
  const filterBoxH = 9 + filterRows * 7;
  const filterBoxY = 47;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(ML, filterBoxY, cW, filterBoxH, 3, 3, "F");
  doc.setFillColor(...PDF_C.blue);
  doc.roundedRect(ML, filterBoxY, 4, filterBoxH, 2, 2, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(ML + 2.5, filterBoxY, 2.5, filterBoxH, "F");

  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_C.navy);
  doc.text("ACTIVE FILTERS", ML + 9, filterBoxY + 6);

  if (activeFilters.length === 0) {
    doc.setFontSize(7.5); doc.setFont("helvetica", "italic");
    doc.setTextColor(...PDF_C.mid);
    doc.text("No filters applied — showing all data", ML + 9, filterBoxY + 13);
  } else {
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_C.dark);
    activeFilters.forEach((f, fi) => {
      const col = fi % 2;
      const row = Math.floor(fi / 2);
      const fx  = ML + 9 + col * (cW / 2);
      const fy  = filterBoxY + 13 + row * 7;
      doc.text(pdfTruncate(doc, "• " + f, cW / 2 - 14), fx, fy);
    });
  }

  // Metrics cards
  const sumY    = filterBoxY + filterBoxH + 5;
  const metricW = (cW - (metrics.length - 1) * 3) / metrics.length;
  const metricH = 26;

  metrics.forEach((m, i) => {
    const bx = ML + i * (metricW + 3);
    doc.setFillColor(...m.color);
    doc.roundedRect(bx, sumY, metricW, metricH, 2, 2, "F");
    const lighter: RGB = [
      Math.min(m.color[0] + 25, 255),
      Math.min(m.color[1] + 25, 255),
      Math.min(m.color[2] + 25, 255),
    ];
    doc.setFillColor(...lighter);
    doc.roundedRect(bx, sumY, metricW, metricH * 0.36, 2, 2, "F");
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_C.white);
    doc.text(m.value, bx + metricW / 2, sumY + 14, { align: "center" });
    doc.setFontSize(6); doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 230, 255);
    doc.text(m.label, bx + metricW / 2, sumY + 21.5, { align: "center" });
  });

  doc.setFontSize(7); doc.setFont("helvetica", "italic");
  doc.setTextColor(...PDF_C.lgray);
  doc.text(
    "This report is confidential and intended for internal use only.",
    pageW / 2, pageH - 22, { align: "center" }
  );
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}`,
    pageW / 2, pageH - 16, { align: "center" }
  );

  // Cover footer bar (no page numbers on cover)
  doc.setFillColor(...PDF_C.navy);
  doc.rect(0, pageH - FOOTER_H, pageW, FOOTER_H, "F");
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
const FacultyListPage: React.FC = () => {
  const { user, getAuthHeaders, isAdmin, isHoD } = useAuth();

  const [loading,            setLoading]            = useState<boolean>(true);
  const [faculty,            setFaculty]            = useState<Faculty[]>([]);
  const [currentFaculty,     setCurrentFaculty]     = useState<Faculty[]>([]);
  const [filteredFaculty,    setFilteredFaculty]    = useState<Faculty[]>([]);
  const [error,              setError]              = useState<string | null>(null);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableDomains,   setAvailableDomains]   = useState<string[]>([]);
  const [pdfLoading,         setPdfLoading]         = useState<boolean>(false);
  const [papersLoading,      setPapersLoading]      = useState<boolean>(false);
  const [scopusLoading,      setScopusLoading]      = useState<Record<string, boolean>>({});
  const [allFacultyForPDF,   setAllFacultyForPDF]   = useState<Faculty[]>([]);
  const [showDownloadMenu,   setShowDownloadMenu]   = useState<boolean>(false);
  const [criteriaWarning,    setCriteriaWarning]    = useState<string>("");

  const {
    ready,
    timeframe,        setTimeframe,
    sdgFilter,        setSdgFilter,
    domainFilter,     setDomainFilter,
    departmentFilter, setDepartmentFilter,
    searchQuery,      setSearchQuery,
    criteriaVisible,  setCriteriaVisible,
    criteriaStart,    setCriteriaStart,
    criteriaEnd,      setCriteriaEnd,
    criteriaPapers,   setCriteriaPapers,
    resetFilters,
  } = useFacultyListFilters();

  const currentYear  = new Date().getFullYear();
  const previousYear = currentYear - 1;

  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => { fetchFaculty(); }, []);                                           // eslint-disable-line
  useEffect(() => { if (!criteriaVisible) fetchFaculty(); }, [sdgFilter, domainFilter, timeframe, departmentFilter]); // eslint-disable-line

  // Fetch available domains when department changes (only for C.Tech)
  useEffect(() => {
    if (departmentFilter !== "C.Tech") {
      setAvailableDomains([]);
      // DO NOT reset domainFilter here — it wipes the restored value on remount
      return;
    }

    const fetchAvailableDomains = async () => {
      try {
        const headers = getAuthHeaders();
        const url = `https://srm-sp-production.up.railway.app/api/faculty/available-domains?department=${encodeURIComponent(departmentFilter)}`;
        const response = await axios.get(url, { headers });
        if (response.data.success) {
          setAvailableDomains(response.data.data || []);
        } else {
          setAvailableDomains([]);
        }
        // Only reset domainFilter if the restored value isn't valid for this department
        // i.e. don't blindly reset to 'none' on every mount
      } catch (err) {
        console.error('Failed to fetch available domains:', err);
        setAvailableDomains([]);
      }
    };
    fetchAvailableDomains();
  }, [departmentFilter, getAuthHeaders]);

  // Close download menu on outside click
  useEffect(() => {
    if (!showDownloadMenu) return;
    const close = () => setShowDownloadMenu(false);
    const id = window.setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", close);
    };
  }, [showDownloadMenu]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchFaculty = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      const isFiltering = sdgFilter !== "none" || domainFilter !== "none" || timeframe !== "none";
      if (sdgFilter    !== "none") params.sdg    = sdgFilter;
      if (domainFilter !== "none") params.domain = domainFilter;
      if (timeframe    !== "none") params.year   = timeframe;
      const headers = getAuthHeaders();
      if (isAdmin() && departmentFilter && departmentFilter !== "all") params.department = departmentFilter;

      const response = await axios.get("https://srm-sp-production.up.railway.app/api/faculty", { params, headers });
      const depts = Array.from(
        new Set(response.data.filter((f: Faculty) => f.department).map((f: Faculty) => f.department))
      );
      setAvailableDepartments(depts as string[]);

      const allWithDocs: Faculty[] = response.data.map((f: Faculty) => ({
        ...f,
        docs_in_timeframe: isFiltering ? f.docs_in_timeframe : undefined,
      }));

      setAllFacultyForPDF(
        [...allWithDocs].sort(
          (a, b) => (b.docs_in_timeframe ?? b.docs_count) - (a.docs_in_timeframe ?? a.docs_count)
        )
      );

      const processed = allWithDocs
        .filter((f) => !isFiltering || (f.docs_in_timeframe ?? 0) > 0)
        .sort((a, b) => (b.docs_in_timeframe ?? b.docs_count) - (a.docs_in_timeframe ?? a.docs_count));

      setFaculty(processed);
      setCurrentFaculty(processed);
      setFilteredFaculty(processed);
    } catch (err) {
      setError("Failed to fetch faculty data");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCriteriaFilteredFaculty = async () => {
    if (!criteriaStart && !criteriaEnd && (!criteriaPapers || criteriaPapers <= 0)) {
      alert("Please enter either Start/End Date or Minimum Papers to filter.");
      return;
    }
    try {
      setLoading(true);
      const params: Record<string, string | number> = {};
      if (criteriaStart)        params.start  = criteriaStart;
      if (criteriaEnd)          params.end    = criteriaEnd;
      if (criteriaPapers > 0)   params.papers = criteriaPapers;
      const headers = getAuthHeaders();
      if (isAdmin() && departmentFilter && departmentFilter !== "all") params.department = departmentFilter;
      const response = await axios.get("https://srm-sp-production.up.railway.app/api/faculty/criteria-filter", { params, headers });
      const updated: Faculty[] = response.data
        .map((m: Faculty) => ({ ...m, docs_in_timeframe: m.timeframe_docs }))
        .sort((a: Faculty, b: Faculty) => (b.docs_in_timeframe ?? 0) - (a.docs_in_timeframe ?? 0));
      setAllFacultyForPDF(updated);
      setFaculty(updated);
      setCurrentFaculty(updated);
      setFilteredFaculty(updated);
    } catch (err) {
      console.error("Error fetching criteria-filtered faculty:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFacultyByTimeframe = async (selectedTimeframe: string) => {
    setTimeframe(selectedTimeframe);
    if (selectedTimeframe === "none") {
      const sorted = [...faculty].sort((a, b) => b.docs_count - a.docs_count);
      setCurrentFaculty(sorted);
      applyAllFilters(sorted);
      return;
    }
    try {
      const headers = getAuthHeaders();
      const params: Record<string, string> = {};
      if (isAdmin() && departmentFilter && departmentFilter !== "all") params.department = departmentFilter;
      const response = await axios.get(
        `https://srm-sp-production.up.railway.app/api/faculty/papers?timeframe=${selectedTimeframe}`,
        { headers, params }
      );
      const docsMap: Record<string, number> = {};
      response.data.forEach((f: Faculty) => { docsMap[f.faculty_id] = f.timeframe_docs; });
      const updated = faculty
        .map(m => ({ ...m, docs_in_timeframe: docsMap[m.faculty_id] ?? 0 }))
        .filter(m => (m.docs_in_timeframe ?? 0) > 0)
        .sort((a, b) => (b.docs_in_timeframe ?? 0) - (a.docs_in_timeframe ?? 0));
      setCurrentFaculty(updated);
      applyAllFilters(updated);
    } catch (err) {
      console.error("Error fetching faculty data:", err);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw   = e.target.value;
    const query = raw.toLowerCase();
    setSearchQuery(raw);
    if (!query) { setFilteredFaculty(currentFaculty); return; }
    setFilteredFaculty(
      currentFaculty.filter(m =>
        (m.name && m.name.toLowerCase().includes(query)) ||
        (m.scopus_ids && m.scopus_ids.some(id => id.toLowerCase().includes(query))) ||
        (m.faculty_id && String(m.faculty_id).toLowerCase().includes(query))
      )
    );
  };

  const applyAllFilters = (baseList?: Faculty[]) => {
    let list = baseList ?? currentFaculty;
    if (sdgFilter    !== "none") list = list.filter(f => f.sdg    && f.sdg.toLowerCase().includes(sdgFilter.toLowerCase()));
    if (domainFilter !== "none") list = list.filter(f => f.domain && f.domain.toLowerCase().includes(domainFilter.toLowerCase()));
    if (isAdmin() && departmentFilter !== "all") list = list.filter(f => f.department === departmentFilter);
    setFilteredFaculty(list);
  };

  const handleCriteriaClick = () => {
    if (criteriaVisible) {
      // Hiding — reset criteria inputs, clear warning, reload data
      setCriteriaStart("");
      setCriteriaEnd("");
      setCriteriaPapers(0);
      setCriteriaWarning("");
      setCriteriaVisible(false);   // ← explicit false, not toggling via callback
      resetFilters();
      fetchFaculty();
    } else {
      // Opening — warn about any conflicting active filters and clear them
      const active: string[] = [];
      if (timeframe    !== "none") active.push("Year Filter");
      if (sdgFilter    !== "none") active.push("SDG Filter");
      if (domainFilter !== "none") active.push("Domain Filter");

      if (active.length > 0) {
        setCriteriaWarning(
          `The following filter${active.length > 1 ? "s have" : " has"} been cleared to use Criteria Filter: ${active.join(", ")}.`
        );
        setTimeframe("none");
        setSdgFilter("none");
        setDomainFilter("none");
      } else {
        setCriteriaWarning("");
      }
      setCriteriaVisible(true);    // ← explicit true, not toggling via callback
    }
  };

  const buildViewDetailsQuery = () => {
    const p = new URLSearchParams();
    if (criteriaVisible && criteriaStart && criteriaEnd) {
      p.set("start", criteriaStart);
      p.set("end",   criteriaEnd);
    } else {
      if (sdgFilter    !== "none") p.set("sdg",    sdgFilter);
      if (domainFilter !== "none") p.set("domain", domainFilter);
      if (timeframe    !== "none") p.set("year",   timeframe);
    }
    return p.toString();
  };

  // ── Shared PDF constants ───────────────────────────────────────────────────
  const PDF_ML      = 15;
  const PDF_MR      = 15;
  const PDF_FOOTER  = 10;

  // ════════════════════════════════════════════════════════════════════════════
  // COMPLETE FACULTY LIST PDF REPORT
  // ════════════════════════════════════════════════════════════════════════════
  const generatePDF = async () => {
    if (allFacultyForPDF.length === 0) { alert("No faculty data to export."); return; }
    setPdfLoading(true);
    try {
      const doc   = new jsPDF("portrait", "mm", "a4");
      const pageW = doc.internal.pageSize.getWidth();   // 210 mm
      const pageH = doc.internal.pageSize.getHeight();  // 297 mm
      const ML    = PDF_ML;   // 15 mm left margin
      const MR    = PDF_MR;   // 15 mm right margin
      const cW    = pageW - ML - MR;  // 180 mm content width
      const FH    = PDF_FOOTER;

      const header = (lbl: string) => drawPDFPageHeader(doc, pageW, ML, MR, lbl);
      const footer = (n: number, tot: number, lbl: string) => drawPDFFooter(doc, n, tot, pageW, pageH, ML, MR, FH, lbl);
      const trunc  = (text: string, maxW: number) => pdfTruncate(doc, text, maxW);

      // Is any filter active?
      const isFiltered =
        (criteriaVisible && (!!criteriaStart || !!criteriaEnd || criteriaPapers > 0)) ||
        timeframe    !== "none" ||
        sdgFilter    !== "none" ||
        domainFilter !== "none";

      const filteredColLabel = (() => {
        if (criteriaVisible && criteriaStart && criteriaEnd) return `${criteriaStart} → ${criteriaEnd}`;
        if (criteriaVisible && criteriaStart)                return `From ${criteriaStart}`;
        if (criteriaVisible && criteriaEnd)                  return `Until ${criteriaEnd}`;
        if (timeframe    !== "none") return `Year ${timeframe}`;
        if (sdgFilter    !== "none") return sdgFilter;
        if (domainFilter !== "none") return domainFilter.length > 16 ? domainFilter.slice(0, 15) + "…" : domainFilter;
        return "Filtered";
      })();

      // Active filters list for cover
      const activeFilters: string[] = [];
      if (criteriaVisible && criteriaStart && criteriaEnd) {
        activeFilters.push(`Date Range: ${criteriaStart} to ${criteriaEnd}`);
      } else {
        if (timeframe    !== "none") activeFilters.push(`Year: ${timeframe}`);
        if (sdgFilter    !== "none") activeFilters.push(`SDG: ${sdgFilter}`);
        if (domainFilter !== "none") activeFilters.push(`Domain: ${domainFilter}`);
      }
      if (isAdmin() && departmentFilter !== "all") activeFilters.push(`Department: ${departmentFilter}`);
      if (searchQuery.trim())    activeFilters.push(`Search: "${searchQuery.trim()}"`);
      if (criteriaVisible && criteriaPapers > 0) activeFilters.push(`Min Papers: ${criteriaPapers}`);

      const filteredTotal = allFacultyForPDF.reduce((s, f) => s + (f.docs_in_timeframe ?? 0), 0);
      const allDocsTotal  = allFacultyForPDF.reduce((s, f) => s + (f.docs_count ?? 0), 0);
      const deptSet       = new Set(allFacultyForPDF.map(f => f.department).filter(Boolean));

      const coverMetrics: { label: string; value: string; color: RGB }[] = [
        { label: "FACULTY MEMBERS",                             value: String(allFacultyForPDF.length),               color: PDF_C.navy },
        { label: isFiltered ? "FILTERED DOCS" : "TOTAL DOCS",  value: String(isFiltered ? filteredTotal : allDocsTotal), color: PDF_C.blue },
        { label: "DEPARTMENTS",                                 value: String(deptSet.size),                          color: PDF_C.teal },
      ];

      drawPDFCoverPage(doc, pageW, pageH, ML, MR, cW, FH, "FACULTY LIST", "RESEARCH REPORT", activeFilters, coverMetrics);

      // ── Table page ─────────────────────────────────────────────────────────
      const pdfList = [...allFacultyForPDF].sort((a, b) => {
        if (isFiltered) {
          const diff = (b.docs_in_timeframe ?? 0) - (a.docs_in_timeframe ?? 0);
          if (diff !== 0) return diff;
        }
        return (b.docs_count ?? 0) - (a.docs_count ?? 0);
      });

      doc.addPage();
      header("Faculty List Report");
      let y = 22;

      const ROW_H        = 7.5;
      const HEADER_H     = ROW_H;

      // ── Column layout (all values are absolute X from page left) ──────────
      // Total content width = 180 mm (ML=15 to pageW-MR=195)
      // Columns: # (8) | Faculty ID (30) | Name (72) | Department (44) | Docs (26)
      // Gaps between cols: text starts 2 mm inside each column's left edge
      // -----------------------------------------------------------------------
      const COL_NUM_X   = ML;           // x=15  → width 8 mm
      const COL_FID_X   = ML + 9;       // x=24  → width 30 mm
      const COL_NAME_X  = ML + 40;      // x=55  → width 72 mm
      const COL_DEPT_X  = ML + 113;     // x=128 → width 42 mm
      const COL_DOCS_X  = ML + 156;     // x=171 → width 24 mm (right-aligned)

      // Max text widths (leave 2 mm right padding inside each cell)
      const W_NUM   = 7;
      const W_FID   = 29;
      const W_NAME  = 71;
      const W_DEPT  = 41;
      const W_DOCS  = 22;

      // Section heading
      doc.setFillColor(...PDF_C.ice);
      doc.rect(ML, y, cW, 9, "F");
      doc.setFillColor(...PDF_C.navy);
      doc.rect(ML, y, 3, 9, "F");
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...PDF_C.navy);
      doc.text(
        `Faculty Members  (${pdfList.length} records)` +
          (isFiltered ? `   ·   Filter: ${filteredColLabel}` : "   ·   No filter — all publications"),
        ML + 7, y + 6.2
      );
      doc.setTextColor(0, 0, 0);
      y += 12;

      // Table header — defined as a closure so it can be called on new pages
      const drawTableHeader = () => {
        doc.setFillColor(30, 60, 160);
        doc.rect(ML, y, cW, HEADER_H, "F");
        doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...PDF_C.white);
        const midY = y + HEADER_H * 0.66;

        doc.text("#",          COL_NUM_X,  midY);
        doc.text("Faculty ID", COL_FID_X,  midY);
        doc.text("Name",       COL_NAME_X, midY);
        doc.text("Department", COL_DEPT_X, midY);

        if (isFiltered) {
          doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
          doc.text("Filtered Docs", COL_DOCS_X, midY);
        } else {
          doc.text("Total Docs", COL_DOCS_X, midY);
        }
        doc.setTextColor(0, 0, 0);
        y += HEADER_H;
      };
      drawTableHeader();

      let grandTotal     = 0;
      const maxFiltered  = Math.max(...pdfList.map(f => f.docs_in_timeframe ?? 0), 1);

      pdfList.forEach((member, idx) => {
        if (y + ROW_H > pageH - FH - 6) {
          doc.addPage();
          header("Faculty List Report");
          y = 22;
          drawTableHeader();
        }

        const bg: RGB = idx % 2 === 0 ? PDF_C.silver : PDF_C.white;
        doc.setFillColor(...bg);
        doc.rect(ML, y, cW, ROW_H, "F");

        // Left accent bar only for rows that have filtered docs
        if (isFiltered && (member.docs_in_timeframe ?? 0) > 0) {
          doc.setFillColor(...PDF_C.teal);
          doc.rect(ML, y, 2.5, ROW_H, "F");
        }

        // Draw a subtle right border on each column to visually contain content
        doc.setDrawColor(220, 222, 235);
        doc.setLineWidth(0.2);
        // vertical separators at column boundaries
        [COL_FID_X - 1, COL_NAME_X - 1, COL_DEPT_X - 1, COL_DOCS_X - 1].forEach(lx => {
          doc.line(lx, y, lx, y + ROW_H);
        });
        doc.setLineWidth(0.1);

        const textY = y + 5;

        // # (row number)
        doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...PDF_C.dark);
        doc.text(trunc(String(idx + 1), W_NUM), COL_NUM_X, textY);

        // Faculty ID
        doc.setTextColor(...PDF_C.dark);
        doc.text(trunc(String(member.faculty_id || "N/A"), W_FID), COL_FID_X, textY);

        // Name
        doc.setFont("helvetica", "bold"); doc.setTextColor(...PDF_C.navy);
        doc.text(trunc(member.name || "N/A", W_NAME), COL_NAME_X, textY);

        // Department
        doc.setFont("helvetica", "normal"); doc.setTextColor(...PDF_C.dark);
        doc.text(trunc(member.department || "N/A", W_DEPT), COL_DEPT_X, textY);

        // Docs count
        if (isFiltered) {
          const fd    = member.docs_in_timeframe;
          const fdVal = fd ?? 0;
          grandTotal += fdVal;
          const fdColor: RGB = fd === undefined ? PDF_C.mid : fdVal > 0 ? PDF_C.green : PDF_C.red;
          doc.setFont("helvetica", "bold"); doc.setTextColor(...fdColor);
          doc.text(fd === undefined ? "—" : String(fdVal), COL_DOCS_X, textY);
          // Mini bar inside the docs cell
          if (fdVal > 0) {
            const barMaxW = W_DOCS - 2;
            const barW    = Math.max(1, (fdVal / maxFiltered) * barMaxW);
            doc.setFillColor(...PDF_C.teal);
            doc.rect(COL_DOCS_X, y + 5.8, barW, 1, "F");
          }
        } else {
          const totalD = member.docs_count ?? 0;
          grandTotal  += totalD;
          doc.setFont("helvetica", "bold"); doc.setTextColor(...PDF_C.navy);
          doc.text(String(totalD), COL_DOCS_X, textY);
        }

        doc.setTextColor(0, 0, 0);
        y += ROW_H;
      });

      // Totals row
      if (y + ROW_H + 2 > pageH - FH - 6) {
        doc.addPage(); header("Faculty List Report"); y = 22;
      }
      doc.setDrawColor(...PDF_C.navy); doc.setLineWidth(0.4);
      doc.line(ML, y, ML + cW, y);
      doc.setFillColor(...PDF_C.ice);
      doc.rect(ML, y, cW, ROW_H + 1, "F");
      doc.setFillColor(...PDF_C.navy);
      doc.rect(ML, y, cW, 0.5, "F");
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...PDF_C.navy);
      doc.text("TOTALS", COL_NAME_X, y + 5.5);
      if (isFiltered) {
        const totColor: RGB = grandTotal > 0 ? PDF_C.green : PDF_C.mid;
        doc.setTextColor(...totColor);
        doc.text(String(grandTotal), COL_DOCS_X, y + 5.5);
        doc.setFontSize(5.5); doc.setFont("helvetica", "italic"); doc.setTextColor(...PDF_C.mid);
        doc.text("filtered total", COL_DOCS_X, y + 9.5);
      } else {
        doc.text(String(grandTotal), COL_DOCS_X, y + 5.5);
      }
      doc.setTextColor(0, 0, 0);
      y += ROW_H + 1;

      // Summary note
      if (isFiltered && y + 12 < pageH - FH - 6) {
        y += 5;
        const zeroCount    = pdfList.filter(f => (f.docs_in_timeframe ?? 0) === 0).length;
        const nonZeroCount = pdfList.length - zeroCount;
        doc.setFillColor(232, 245, 255);
        doc.roundedRect(ML, y, cW, 10, 2, 2, "F");
        doc.setFillColor(...PDF_C.blue);
        doc.roundedRect(ML, y, 3, 10, 1, 1, "F");
        doc.setFillColor(232, 245, 255);
        doc.rect(ML + 2, y, 2, 10, "F");
        doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...PDF_C.dark);
        doc.text(
          `${nonZeroCount} faculty member${nonZeroCount !== 1 ? "s" : ""} have publications under the applied filter`,
          ML + 8, y + 6.5
        );
        doc.setTextColor(0, 0, 0);
      }

      // Stamp all page footers
      const totalPages = (doc.internal as any).getNumberOfPages() as number;
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        if (p > 1) header("Faculty List Report");
        footer(p, totalPages, "Faculty List Report");
      }

      const deptLabel = departmentFilter !== "all" ? `_${departmentFilter.replace(/\s+/g, "_")}` : "";
      const yearLabel = timeframe        !== "none" ? `_${timeframe}` : "";
      doc.save(`FacultyList${deptLabel}${yearLabel}.pdf`);

    } catch (err: any) {
      console.error("PDF generation failed:", err);
      alert(`Failed to generate PDF: ${err.message || "Unknown error"}`);
    } finally {
      setPdfLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // IEEE PAPERS PDF EXPORT
  // ════════════════════════════════════════════════════════════════════════════
  const downloadPapersIEEE = async () => {
    setPapersLoading(true);
    try {
      const params = new URLSearchParams();
      if (isAdmin() && departmentFilter !== "all") params.append("department", departmentFilter);
      if (timeframe !== "none") params.append("year", timeframe);
      const headers  = getAuthHeaders();
      const response = await axios.get(
        `https://srm-sp-production.up.railway.app/api/faculty/papers-ieee/export?${params.toString()}`,
        { headers }
      );

      if (!response.data.success || !response.data.papers) {
        alert("Failed to fetch papers data"); return;
      }
      const papers: PaperRecord[] = response.data.papers;
      if (papers.length === 0) { alert("No papers available for export"); return; }

      const doc   = new jsPDF("portrait", "mm", "a4");
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const ML    = PDF_ML;
      const MR    = PDF_MR;
      const cW    = pageW - ML - MR;
      const FH    = PDF_FOOTER;

      const header = (lbl: string) => drawPDFPageHeader(doc, pageW, ML, MR, lbl);
      const footer = (n: number, tot: number, lbl: string) =>
        drawPDFFooter(doc, n, tot, pageW, pageH, ML, MR, FH, lbl);

      // Cover page
      const coverFilters: string[] = [];
      if (isAdmin() && departmentFilter !== "all") coverFilters.push(`Department: ${departmentFilter}`);
      if (timeframe !== "none") coverFilters.push(`Year: ${timeframe}`);

      const coverMetrics: { label: string; value: string; color: RGB }[] = [
        { label: "TOTAL PAPERS",  value: String(papers.length),                                             color: PDF_C.navy },
        { label: "YEAR / FILTER", value: timeframe !== "none" ? timeframe : "ALL",                          color: PDF_C.blue },
        { label: "DEPARTMENT",    value: departmentFilter !== "all" ? departmentFilter.slice(0, 8).toUpperCase() : "ALL", color: PDF_C.teal },
      ];
      drawPDFCoverPage(doc, pageW, pageH, ML, MR, cW, FH, "FACULTY PAPERS", "IEEE CITATION REPORT", coverFilters, coverMetrics);

      // Group papers by type
      const grouped: Record<string, PaperRecord[]> = {};
      papers.forEach(p => {
        const key = p.type || "Journal";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(p);
      });
      const typeOrder   = ["Journal", "Conference Proceeding", "Book"];
      const sortedTypes = [
        ...typeOrder.filter(t => grouped[t]),
        ...Object.keys(grouped).filter(t => !typeOrder.includes(t)),
      ];

      doc.addPage();
      header("IEEE Papers Report");
      let y = 22;

      // Citation block constants
      const LINE_H    = 5.5;  // mm per text line
      const BLOCK_PAD = 4;    // top & bottom padding inside each block
      const REF_X     = ML + 3;   // x of "[n]" label
      const TEXT_X    = ML + 10;  // x of citation text (indented past "[n]")
      const MAX_TEXT_W = cW - (TEXT_X - ML) - 2;  // max width for wrapped text

      let refNum = 1;

      sortedTypes.forEach(type => {
        const group = grouped[type];
        if (!group?.length) return;

        // Section heading — ensure it fits on page
        const headH = 9;
        if (y + headH > pageH - FH - 10) {
          doc.addPage(); header("IEEE Papers Report"); y = 22;
        }
        doc.setFillColor(...PDF_C.ice);
        doc.rect(ML, y, cW, headH, "F");
        doc.setFillColor(...PDF_C.navy);
        doc.rect(ML, y, 3, headH, "F");
        doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...PDF_C.navy);
        doc.text(
          `${type}s  (${group.length} ${group.length === 1 ? "paper" : "papers"})`,
          ML + 7, y + 6.2
        );
        doc.setTextColor(0, 0, 0);
        y += headH + 4;

        group.forEach(paper => {
          const citation = paper.ieee_format || "Citation not available.";

          // Word-wrap citation into lines that fit MAX_TEXT_W
          doc.setFontSize(8); doc.setFont("helvetica", "normal");
          const words = citation.split(" ");
          const lines: string[] = [];
          let cur = "";
          words.forEach(word => {
            const test = cur ? cur + " " + word : word;
            if (doc.getTextWidth(test) <= MAX_TEXT_W) {
              cur = test;
            } else {
              if (cur) lines.push(cur);
              // Single overlong word — truncate it
              if (doc.getTextWidth(word) > MAX_TEXT_W) {
                let w = word;
                while (w.length > 1 && doc.getTextWidth(w) > MAX_TEXT_W) w = w.slice(0, -1);
                cur = w;
              } else {
                cur = word;
              }
            }
          });
          if (cur) lines.push(cur);

          // Block height = top pad + lines + bottom pad
          const blockH = BLOCK_PAD + lines.length * LINE_H + BLOCK_PAD;

          // Page break if block doesn't fit
          if (y + blockH > pageH - FH - 6) {
            doc.addPage(); header("IEEE Papers Report"); y = 22;
          }

          // Alternating row background
          const bg: RGB = refNum % 2 === 0 ? PDF_C.silver : PDF_C.white;
          doc.setFillColor(...bg);
          doc.rect(ML, y, cW, blockH, "F");

          // Left accent bar
          doc.setFillColor(...PDF_C.blue);
          doc.rect(ML, y, 2, blockH, "F");

          // [n] label — baseline aligned to first line of text
          const firstLineBaseline = y + BLOCK_PAD + LINE_H * 0.78;
          doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...PDF_C.navy);
          doc.text(`[${refNum}]`, REF_X, firstLineBaseline);

          // Citation lines
          doc.setFont("helvetica", "normal"); doc.setTextColor(...PDF_C.dark);
          lines.forEach((line, li) => {
            doc.text(line, TEXT_X, y + BLOCK_PAD + li * LINE_H + LINE_H * 0.78);
          });

          doc.setTextColor(0, 0, 0);
          y += blockH + 1;
          refNum++;
        });

        y += 4; // gap between type sections
      });

      // Summary info box at the end
      if (y + 12 < pageH - FH - 6) {
        y += 4;
        doc.setFillColor(232, 245, 255);
        doc.roundedRect(ML, y, cW, 10, 2, 2, "F");
        doc.setFillColor(...PDF_C.navy);
        doc.roundedRect(ML, y, 3, 10, 1, 1, "F");
        doc.setFillColor(232, 245, 255);
        doc.rect(ML + 2, y, 2, 10, "F");
        doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(...PDF_C.navy);
        doc.text(`Total Papers Listed: ${papers.length}`, ML + 8, y + 6.5);
        doc.setTextColor(0, 0, 0);
      }

      // Stamp all page footers
      const totalPages = (doc.internal as any).getNumberOfPages() as number;
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        if (p > 1) header("IEEE Papers Report");
        footer(p, totalPages, "IEEE Papers Report");
      }

      const deptSuffix = isAdmin() && departmentFilter !== "all" ? `_${departmentFilter.replace(/\s+/g, "_")}` : "";
      const yearSuffix = timeframe !== "none" ? `_${timeframe}` : "";
      doc.save(`FacultyPapers${deptSuffix}${yearSuffix}_IEEE.pdf`);
      setShowDownloadMenu(false);

    } catch (err: any) {
      console.error("Failed to download papers:", err);
      alert("Failed to download papers. Please try again.");
    } finally {
      setPapersLoading(false);
    }
  };

  // ── Active filter detection & clear handler ──────────────────────────
  const hasActiveFilters =
    timeframe !== "none" ||
    sdgFilter !== "none" ||
    domainFilter !== "none" ||
    (isAdmin() && departmentFilter !== "all") ||
    searchQuery.trim() !== "" ||
    (criteriaVisible && (criteriaStart !== "" || criteriaEnd !== "" || criteriaPapers > 0));

  const handleClearFilters = () => {
    resetFilters();             // wipes sessionStorage + resets all state
    setSearchQuery("");         // also clear the search field
    fetchFaculty();             // re-fetch with no filters
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  if (loading) return <div className="loading">Loading faculty data...</div>;
  if (error)   return <div className="error-message">{error}</div>;

  const anyLoading = pdfLoading || papersLoading;

  return (
    <div>
      {/* NAVBAR */}
      <div className="shared-navbar">
        <a className="shared-logo">
          <img src={srmLogo} alt="SRM Logo" className="shared-nav-logo" />
          <span>SRM SP</span>
        </a>
        <UserMenu />
      </div>

      <div className="faculty-container">
        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "10px" }}>
          <Link to="/dashboard" className="shared-back-button">&laquo; Back to Dashboard</Link>
        </div>

        <h1 className="title">Faculty List</h1>

        {/* ── Filter Bar ── */}
        <div
          className="filter-bar"
          style={{
            display: "flex", alignItems: "center",
            flexWrap: "wrap", gap: "8px",
            justifyContent: "space-between",
          }}
        >
          {/* Left: all filter controls */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <select
              value={timeframe}
              onChange={e => fetchFacultyByTimeframe(e.target.value)}
              className={`dropdown${timeframe !== "none" ? " dropdown--active" : ""}`}
              disabled={criteriaVisible}
              title={criteriaVisible ? "Disabled while Criteria Filter is active" : ""}
              style={{ cursor: criteriaVisible ? "not-allowed" : "pointer", opacity: criteriaVisible ? 0.45 : 1 }}
            >
              <option value="none">Year Filter</option>
              <option value={currentYear.toString()}>{currentYear}</option>
              <option value={previousYear.toString()}>{previousYear}</option>
            </select>

            <select
              value={sdgFilter}
              onChange={e => setSdgFilter(e.target.value)}
              className={`dropdown${sdgFilter !== "none" ? " dropdown--active" : ""}`}
              disabled={criteriaVisible}
              title={criteriaVisible ? "Disabled while Criteria Filter is active" : ""}
              style={{ cursor: criteriaVisible ? "not-allowed" : "pointer", opacity: criteriaVisible ? 0.45 : 1 }}
            >
              <option value="none">SDG Filter</option>
              {[...Array(17)].map((_, i) => (
                <option key={i + 1} value={`SDG${i + 1}`}>SDG {i + 1}</option>
              ))}
            </select>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <select
                value={domainFilter}
                onChange={e => setDomainFilter(e.target.value)}
                className={`dropdown${domainFilter !== "none" ? " dropdown--active" : ""}`}
                disabled={criteriaVisible || (departmentFilter === "C.Tech" && availableDomains.length === 0)}
                title={
                  criteriaVisible
                    ? "Disabled while Criteria Filter is active"
                    : departmentFilter === "C.Tech" && availableDomains.length === 0
                    ? "No domains available for this department"
                    : ""
                }
                style={{
                  cursor: (criteriaVisible || (departmentFilter === "C.Tech" && availableDomains.length === 0))
                    ? "not-allowed" : "pointer",
                  opacity: (criteriaVisible || (departmentFilter === "C.Tech" && availableDomains.length === 0))
                    ? 0.45 : 1,
                }}
              >
                <option value="none">Domain Filter</option>
                {departmentFilter === "C.Tech" ? (
                  availableDomains.length > 0 ? (
                    availableDomains.map(d => <option key={d} value={d}>{d}</option>)
                  ) : (
                    <option value="none" disabled>No domains available</option>
                  )
                ) : (
                  [
                    "Agriculture & Forestry","Architecture","Biological Sciences","Business & Management Studies",
                    "Chemistry","Communication & Media Studies","Computer Science & Information Systems","Data Science",
                    "Development Studies","Earth & Marine Sciences","Economics & Econometrics","Education & Training",
                    "Engineering - Chemical","Engineering - Civil & Structural","Engineering - Electrical & Electronic",
                    "Engineering - Mechanical","Engineering - Mineral & Mining","Engineering - Petroleum",
                    "Environmental Sciences","Geography","Geology","Geophysics","Law and Legal Studies",
                    "Library & Information Management","Linguistics","Materials Science","Mathematics","Medicine",
                    "Nursing","Pharmacy & Pharmacology","Physics & Astronomy","Psychology","Statistics & Operational Research",
                  ].map(d => <option key={d} value={d}>{d}</option>)
                )}
              </select>
              {departmentFilter === "C.Tech" && availableDomains.length > 0 && (
                <span style={{ fontSize: "12px", padding: "6px 10px", backgroundColor: "#e8f4f8", border: "1px solid #4CAF50", borderRadius: "4px", color: "#2c5aa0", fontWeight: "500", whiteSpace: "nowrap" }}>
                  📊 {availableDomains.length} domain{availableDomains.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {isAdmin() && (
              <select
                value={departmentFilter}
                onChange={e => setDepartmentFilter(e.target.value)}
                className={`dropdown${departmentFilter !== "all" ? " dropdown--active" : ""}`}
              >
                <option value="all">Department Filter</option>
                {availableDepartments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}

            {isHoD() && !isAdmin() && (
              <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", backgroundColor: "#f0f0f0", borderRadius: "4px" }}>
                <span style={{ fontWeight: 500, color: "#333" }}>Department: {user?.department || "Loading..."}</span>
              </div>
            )}

            <button className="criteria-button" onClick={handleCriteriaClick}>
              {criteriaVisible ? "Hide Criteria Filter" : "Criteria Filter"}
            </button>

            {/* ── Clear Filters — only shown when something is active ── */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "7px 13px",
                  background: "#fff0f0",
                  color: "#c0392b",
                  border: "1.5px solid #e8a09a",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#ffe0de";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#c0392b";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#fff0f0";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#e8a09a";
                }}
                title="Reset all filters"
              >
                ✕ Clear Filters
              </button>
            )}
          </div>

          {/* Right: Downloads button */}
          <div
            style={{ position: "relative", display: "inline-block" }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowDownloadMenu(prev => !prev)}
              disabled={anyLoading || allFacultyForPDF.length === 0}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 16px",
                background: anyLoading || allFacultyForPDF.length === 0 ? "#888" : "#000347",
                color: "#fff", border: "none", borderRadius: 6,
                fontSize: "13px", fontWeight: 600,
                cursor: anyLoading || allFacultyForPDF.length === 0 ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                transition: "background 0.2s", whiteSpace: "nowrap",
              }}
            >
              {anyLoading ? (
                <>
                  <span style={{
                    display: "inline-block", width: 13, height: 13,
                    border: "2px solid #fff", borderTopColor: "transparent",
                    borderRadius: "50%", animation: "fl-spin 0.7s linear infinite",
                  }} />
                  Generating…
                </>
              ) : <>📥 Downloads</>}
              <span style={{ fontSize: "10px", marginLeft: "2px" }}>
                {showDownloadMenu ? "▲" : "▼"}
              </span>
            </button>

            {showDownloadMenu && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0,
                background: "#fff", border: "1px solid #dde", borderRadius: "8px",
                boxShadow: "0 6px 20px rgba(0,0,0,0.14)", zIndex: 1000,
                minWidth: "260px", overflow: "hidden",
              }}>
                {/* Complete Report */}
                <button
                  onClick={generatePDF}
                  disabled={pdfLoading}
                  style={{
                    width: "100%", textAlign: "left", padding: "13px 14px",
                    border: "none", background: "none",
                    cursor: pdfLoading ? "not-allowed" : "pointer",
                    fontSize: "13px", color: "#333",
                    display: "flex", alignItems: "flex-start", gap: "10px",
                    borderBottom: "1px solid #f0f0f0", transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f5f7ff")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ fontSize: "18px", marginTop: "1px" }}>📄</span>
                  <div>
                    <div style={{ fontWeight: 700, color: "#1a2a5e" }}>Complete Report</div>
                    <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
                      Faculty list · {timeframe !== "none" ? `Year ${timeframe} docs` : "all docs"} · PDF
                    </div>
                  </div>
                </button>

                {/* IEEE Papers Export */}
                <button
                  onClick={downloadPapersIEEE}
                  disabled={papersLoading}
                  style={{
                    width: "100%", textAlign: "left", padding: "13px 14px",
                    border: "none", background: "none",
                    cursor: papersLoading ? "not-allowed" : "pointer",
                    fontSize: "13px", color: "#333",
                    display: "flex", alignItems: "flex-start", gap: "10px",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f5f7ff")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ fontSize: "18px", marginTop: "1px" }}>📚</span>
                  <div>
                    <div style={{ fontWeight: 700, color: "#1a2a5e" }}>Papers Export</div>
                    <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
                      IEEE citation format · Full author names · PDF
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes fl-spin { to { transform: rotate(360deg); } }

          /* Active state for filter dropdowns */
          .dropdown--active {
            border-color: #3679e0 !important;
            background-color: #eef4ff !important;
            color: #1a3a8f !important;
            font-weight: 600 !important;
            box-shadow: 0 0 0 2px rgba(54, 121, 224, 0.18) !important;
          }
          .dropdown--active:focus {
            outline: none;
            box-shadow: 0 0 0 3px rgba(54, 121, 224, 0.28) !important;
          }
        `}</style>

        {/* Criteria Filter Warning Banner */}
        {criteriaVisible && criteriaWarning && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: "10px", margin: "12px 0 0",
            padding: "10px 16px",
            backgroundColor: "#fff8e1",
            border: "1px solid #f9a825",
            borderLeft: "4px solid #f9a825",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#7a5200",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>⚠️</span>
              <span>{criteriaWarning}</span>
            </div>
            <button
              onClick={() => setCriteriaWarning("")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "16px", color: "#7a5200", lineHeight: 1,
                padding: "0 4px", flexShrink: 0,
              }}
              title="Dismiss"
            >✕</button>
          </div>
        )}

        {/* Criteria Inputs */}
        {criteriaVisible && (
          <div className="criteria-inputs" style={{ margin: "20px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", marginRight: "10px" }}>
              <label>Start Date</label>
              <input
                type="date" value={criteriaStart}
                onChange={e => setCriteriaStart(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginRight: "10px" }}>
              <label>End Date</label>
              <input
                type="date" value={criteriaEnd}
                onChange={e => setCriteriaEnd(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginRight: "10px" }}>
              <label>Minimum Papers</label>
              <input
                type="number"
                value={criteriaPapers === 0 ? "" : criteriaPapers}
                onChange={e => setCriteriaPapers(e.target.value === "" ? 0 : parseInt(e.target.value))}
                min={1}
              />
            </div>
            <button onClick={fetchCriteriaFilteredFaculty} className="apply-button">Apply</button>
          </div>
        )}

        {/* Search Bar */}
        <div className="search-bar">
          <div style={{ position: "relative", display: "inline-block", width: "100%", maxWidth: "400px" }}>
            <input
              type="text"
              placeholder="Search by Name, Faculty ID or Scopus ID..."
              value={searchQuery}
              onChange={handleSearch}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => { setSearchQuery(""); setFilteredFaculty(currentFaculty); }}
              >✕</button>
            )}
          </div>
        </div>

        {/* Faculty Table */}
        <div className="table-wrapper">
          <table className="faculty-table">
            <thead>
              <tr>
                <th>Faculty ID</th>
                <th>Scopus IDs</th>
                <th>Name</th>
                <th>Department</th>
                <th>Total Docs</th>
                <th>Filtered Docs</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFaculty.map(member => (
                <tr key={member.faculty_id}>
                  <td>{member.faculty_id || "Not Available"}</td>
                  <td>
                    {member.scopus_ids && member.scopus_ids.length ? (
                      <span className="scopus-ids" title={member.scopus_ids.join(", ")}>
                        {member.scopus_ids[0]}
                        {member.scopus_ids.length > 1 && (
                          <span className="more-count"> (+{member.scopus_ids.length - 1})</span>
                        )}
                      </span>
                    ) : scopusLoading[member.faculty_id] ? (
                      <span>Loading...</span>
                    ) : (
                      <button
                        className="fetch-ids-button"
                        onClick={async () => {
                          try {
                            setScopusLoading(prev => ({ ...prev, [member.faculty_id]: true }));
                            const h   = getAuthHeaders();
                            const res = await axios.get(
                              `https://srm-sp-production.up.railway.app/api/faculty/${member.faculty_id}`,
                              { headers: h }
                            );
                            const ids: string[] =
                              res.data?.faculty?.scopus_ids ?? [];
                            const update = (list: Faculty[]) =>
                              list.map(f =>
                                f.faculty_id === member.faculty_id ? { ...f, scopus_ids: ids } : f
                              );
                            setFaculty(update);
                            setCurrentFaculty(update);
                            setFilteredFaculty(update);
                          } catch (err) {
                            console.error("Failed to fetch scopus ids", err);
                            alert("Failed to fetch Scopus IDs");
                          } finally {
                            setScopusLoading(prev => ({ ...prev, [member.faculty_id]: false }));
                          }
                        }}
                      >
                        Fetch IDs
                      </button>
                    )}
                  </td>
                  <td>{member.name}</td>
                  <td>{member.department || "N/A"}</td>
                  <td>{member.docs_count}</td>
                  <td>{member.docs_in_timeframe !== undefined ? member.docs_in_timeframe : "N/A"}</td>
                  <td>
                    {ready ? (
                      <Link
                        to={`/faculty/${member.faculty_id}?${buildViewDetailsQuery()}`}
                        className="view-button"
                      >
                        View Details
                      </Link>
                    ) : (
                      <button className="view-button" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
                        View Details
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredFaculty.length === 0 && (
          <div className="no-records">No faculty records found.</div>
        )}
      </div>
    </div>
  );
};

export default FacultyListPage;
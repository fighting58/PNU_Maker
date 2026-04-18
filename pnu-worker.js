/**
 * PNU Worker - Handles heavy PNU generation and BJD matching in a separate thread.
 */

// Utility: Normalize names (copied from app.js)
function normalizeRegionName(name) {
  return String(name || "")
    .replace(/[.,]/g, " ") 
    .replace(/[()\[\]]/g, "") 
    .replace(/\s+/g, " ")
    .trim()
    .replace(/특별자치/g, "")
    .replace(/전라(북|남)도/g, "전$1") 
    .replace(/경상(북|남)도/g, "경$1")
    .replace(/충청(북|남)도/g, "충$1")
    .replace(/(강원|경기|제주)도/g, "$1")
    .replace(/(서울|부산|대구|인천|광주|대전|울산)특별시/g, "$1")
    .replace(/(서울|부산|대구|인천|광주|대전|울산)광역시/g, "$1")
    .replace(/세종시/g, "세종");
}

// Utility: Convert jibun to code (copied from app.js)
function convertJibunToCode(jibunText) {
  let jibun = String(jibunText || "").trim();
  if (!jibun) return null;
  let mt = "1";
  if (jibun.startsWith("산")) { mt = "2"; jibun = jibun.slice(1).trim(); }
  const parts = jibun.split("-");
  const mainStr = parts[0].replace(/[^0-9]/g, ""); 
  if (!mainStr) return null;
  const bon = mainStr.padStart(4, "0");
  const bu = (parts[1] || "0").replace(/[^0-9]/g, "").padStart(4, "0");
  return mt + bon + bu;
}

// Logic: Resolve BJD Code (Local version)
function resolveBjdCode(regionValue, lookup) {
  const raw = String(regionValue || "").trim();
  if (!raw) return null;
  if (/^\d{10}$/.test(raw)) return raw;
  
  const normalized = normalizeRegionName(raw);
  if (lookup.queryToCode.has(normalized)) return lookup.queryToCode.get(normalized);
  if (lookup.fullNameToCode.has(normalized)) return lookup.fullNameToCode.get(normalized);
  
  // Fallback 1: Suffix match
  for (const [fullName, code] of lookup.fullNameToCode.entries()) {
    if (fullName.endsWith(normalized)) return code;
  }
  
  // Fallback 2: Keyword inclusion
  const keywords = normalized.split(" ").filter(k => k.length > 1);
  if (keywords.length > 0) {
    for (const [fullName, code] of lookup.fullNameToCode.entries()) {
      if (keywords.every(k => fullName.includes(k))) return code;
    }
  }

  return null;
}

// Main processing logic
self.onmessage = async function(e) {
  const { type, rows, bjdCache, regionKey, jibunKey } = e.data;

  if (type === "PROCESS") {
    try {
      const uniqueNames = Array.from(new Set(rows.map((row) => String(row[regionKey] || "").trim()).filter(Boolean)));
      const totalUnique = uniqueNames.length;
      
      const lookup = { 
        queryToCode: new Map(), 
        fullNameToCode: new Map() 
      };

      for (let i = 0; i < totalUnique; i++) {
        const rawQuery = uniqueNames[i];
        const normalizedQuery = normalizeRegionName(rawQuery);
        const keywords = normalizedQuery.split(" ").filter(k => k.length > 1);

        if (keywords.length > 0) {
          const candidates = bjdCache.filter(item => {
            const normalizedItemName = normalizeRegionName(item.name);
            return keywords.every(k => normalizedItemName.includes(k));
          });

          if (candidates.length > 0) {
            const bestCandidate = candidates.find(c => normalizeRegionName(c.name) === normalizedQuery) || candidates[0];
            lookup.queryToCode.set(normalizedQuery, bestCandidate.code);
            for (const c of candidates) {
              lookup.fullNameToCode.set(normalizeRegionName(c.name), c.code);
            }
          }
        }
        
        if (i % 20 === 0 || i === totalUnique - 1) {
          self.postMessage({ 
            type: "PROGRESS", 
            phase: "LOOKUP", 
            current: i + 1, 
            total: totalUnique,
            percent: Math.round(((i + 1) / totalUnique) * 50)
          });
        }
      }

      const totalRows = rows.length;
      const resultRows = rows.map((row, idx) => {
        const rawRegion = row[regionKey];
        const rawJibun = row[jibunKey];
        
        const result = { ...row };
        let bjdCode = null;
        let landCode = null;
        let error = "";

        // 1. Validate inputs
        if (!String(rawRegion || "").trim()) {
          error = "FAIL: 행정구역 정보 누락";
        } else if (!String(rawJibun || "").trim()) {
          error = "FAIL: 지번 정보 누락";
        } else {
          // 2. Resolve BJD
          bjdCode = resolveBjdCode(rawRegion, lookup);
          if (!bjdCode) {
            error = `FAIL: [${rawRegion}] 법정동 매칭 실패`;
          } else {
            // 3. Resolve Jibun
            landCode = convertJibunToCode(rawJibun);
            if (!landCode) {
              error = `FAIL: [${rawJibun}] 지번 형식 오류`;
            }
          }
        }

        if (error) {
          result.PNU = "";
          result.PNU_ERROR = error;
        } else {
          result.PNU = `${bjdCode}${landCode}`;
          result.PNU_ERROR = "";
        }

        if (idx % 100 === 0 || idx === totalRows - 1) {
          self.postMessage({ 
            type: "PROGRESS", 
            phase: "GENERATE", 
            current: idx + 1, 
            total: totalRows,
            percent: 50 + Math.round(((idx + 1) / totalRows) * 50)
          });
        }

        return result;
      });

      self.postMessage({ type: "DONE", result: resultRows });

    } catch (err) {
      self.postMessage({ type: "ERROR", message: err.message });
    }
  }
};

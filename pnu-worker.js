/**
 * PNU Worker - Powerful Matching Engine (Restored + Enhanced)
 */

function normalize(name) {
  if (!name) return "";
  // 1. User's original rule: replace region prefixes
  return String(name)
    .replace(/특별자치/g, "")
    .replace(/전라(북|남)도/g, "전$1") 
    .replace(/경상(북|남)도/g, "경$1")
    .replace(/충청(북|남)도/g, "충$1")
    .replace(/(강원|경기|제주)도/g, "$1")
    .replace(/(서울|부산|대구|인천|광주|대전|울산)특별시/g, "$1")
    .replace(/(서울|부산|대구|인천|광주|대전|울산)광역시/g, "$1")
    .replace(/세종시/g, "세종")
    .replace(/ /g, "") // 2. Remove all spaces for loose matching
    .replace(/[.,()\[\]]/g, "")
    .trim();
}

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

self.onmessage = function (e) {
  const { type, rows, bjdCache, regionKey, jibunKey } = e.data;

  if (type === "PROCESS") {
    try {
      if (!bjdCache || bjdCache.length === 0) throw new Error("DB 캐시가 비어있습니다.");

      // Building a highly efficient normalized index
      const lookup = bjdCache.map(v => ({
        code: v.code,
        norm: normalize(v.name)
      }));

      const total = rows.length;
      const resultRows = rows.map((row, idx) => {
        const out = { ...row };
        const rawRegion = String(row[regionKey] || "").trim();
        const normRegion = normalize(rawRegion);
        
        let match = null;
        if (normRegion) {
          // 1. Exact or suffix match using normalized strings
          match = lookup.find(idx => idx.norm === normRegion || idx.norm.endsWith(normRegion));
          
          if (!match) {
            // 2. Fragment match: If input is '분당구 이매동', it should find '경기성남시분당구이매동'
            match = lookup.find(idx => idx.norm.includes(normRegion));
          }
        }

        const landCode = convertJibunToCode(row[jibunKey]);
        if (match && landCode) {
          out.PNU = match.code + landCode;
          out.PNU_ERROR = "";
        } else {
          out.PNU = "";
          if (!match) out.PNU_ERROR = `FAIL: 법정동 매칭 실패 [${rawRegion}]`;
          else if (!landCode) out.PNU_ERROR = `FAIL: 지번 형식 오류 [${row[jibunKey]}]`;
        }

        if (idx % 200 === 0 || idx === total - 1) {
          self.postMessage({ type: "PROGRESS", current: idx + 1, total, percent: Math.round(((idx + 1)/total)*100) });
        }
        return out;
      });

      self.postMessage({ type: "DONE", result: resultRows });
    } catch (err) {
      self.postMessage({ type: "ERROR", message: err.message });
    }
  }
};

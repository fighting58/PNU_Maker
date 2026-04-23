# makePNU | PNU Workbench 🚀

> **지번 주소를 바탕으로 19자리 PNU 코드를 즉시 생성하는 전문 데이터 워크벤치**

![Main Banner](https://github.com/fighting58/PNU_Maker/raw/main/banner.webp)

`makePNU`는 엑셀 또는 CSV 형태의 지번 주소 데이터를 행정표준코드 기반의 19자리 PNU(필지식별번호)로 정밀하게 변환해주는 도구입니다. 복잡한 데이터베이스 설정 없이 즉시 실행 가능한 이동식 환경을 제공하며, 보안과 성능을 모두 고려한 하이브리드 엔진을 탑재하고 있습니다.

---

## ✨ 주요 특징 (Key Features)

### 🎨 Grade S Professional UI/UX
현대적인 **다크 모드 대시보드** 디자인을 적용하여 장시간 작업 시에도 눈의 피로를 최소화하며, 세련된 글라스모피즘(Glassmorphism)과 마이크로 인터랙션을 통해 직관적인 사용자 경험을 제공합니다.

### 🛡️ 하이브리드 처리 엔진 (Hybrid Engine)
- **로컬 엔진 (Web Worker)**: 수만 건 이내의 데이터는 브라우저 내부에서 즉시 처리하여 외부로 데이터가 유출되지 않는 극강의 보안성을 제공합니다.
- **백엔드 엔진 (Standalone Server)**: 수십만 건 이상의 대용량 데이터는 서버 기반 엔진을 통해 안정적이고 빠르게 처리합니다.

### 🔄 실시간 공식 DB 동기화
`code.go.kr` 행정표준코드 관리시스템에서 최신 법정동 데이터를 직접 동기화할 수 있어, 항상 최신 주소 체계에 맞는 정확한 결과를 보장합니다.

### 🧠 지능형 컬럼 자동 감지
파일을 업로드하면 AI 기반 키워드 매칭을 통해 수많은 열 중에서 **주소(행정구역)**와 **지번** 컬럼을 자동으로 찾아 매핑합니다. 사용자는 클릭 한 번으로 바로 분석을 시작할 수 있습니다.

---

## 🛠️ 기술 스택 (Tech Stack)

### Frontend
- **Core**: HTML5, Vanilla CSS3, Modern JavaScript (ES6+)
- **Design**: Google Fonts (Outfit, Inter), Pretendard, Lucide Icons
- **Libraries**: 
  - [SheetJS](https://sheetjs.com/): 엑셀(XLSX/XLS) 파싱 및 생성
  - [PapaParse](https://www.papaparse.com/): 대용량 CSV 파싱
  - [Showdown](http://showdownjs.com/): 마크다운 기반 도움말 렌더링

### Backend
- **Engine**: PowerShell (Windows 환경에서 별도 설치 없이 즉시 실행 가능한 고성능 서버 엔진)
- **Database**: BJD(법정동) 원본 데이터 기반의 실시간 인덱싱 구조

---

## 🚀 시작하기 (Getting Started)

1. **저장소 복제**
   ```bash
   git clone https://github.com/fighting58/PNU_Maker.git
   cd PNU_Maker
   ```

2. **서버 실행**
   - `start.bat` 파일을 더블 클릭하거나,
   - 파워쉘에서 `./server.ps1`을 실행합니다.

3. **접속**
   브라우저에서 `http://localhost:8000`으로 접속하여 서비스를 바로 이용할 수 있습니다.

---

## 📅 업데이트 계획
- [x] 전문 대시보드 디자인(Grade S) 개편
- [x] 공식 BJD DB 동기화 기능 고도화 
- [x] 백엔드 기반 대용량 처리 안정화
- [ ] 주소 검색 자동 완성 기능 추가 (진행 예정)
- [ ] 멀티스레딩 성능 최적화 (진행 예정)

---

## 📄 라이선스
이 프로젝트는 개인 및 기업 사용자를 위해 자유롭게 배포되며, 데이터 보안을 위해 어떤 정보도 누적 관리하지 않습니다.

---
**Developed by [fighting58](https://github.com/fighting58)**

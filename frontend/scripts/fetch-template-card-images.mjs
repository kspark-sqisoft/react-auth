#!/usr/bin/env node
/**
 * 슬라이드 템플릿용 샘플 이미지(img1.jpg … img10.jpg)를 Pexels에서 내려받습니다.
 *
 * 1) https://www.pexels.com/api/ 에서 무료 API 키 발급
 * 2) frontend/.env.local 에 추가:
 *    PEXELS_API_KEY=여기에_키
 * 3) frontend 디렉터리에서:
 *    npm run fetch:cards
 *
 * 라이선스: Pexels 라이선스(상업적 이용 가능). 출처는 public/cards/ATTRIBUTION.txt 참고.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public", "cards");

/** 템플릿(메뉴·뉴스·비주얼 등)에 어울리는 검색어 — img1 … img10 순 */
const QUERIES = [
  "restaurant food plating",
  "coffee cafe latte",
  "burger meal",
  "healthy salad bowl",
  "italian pasta dish",
  "sushi plate",
  "breakfast brunch table",
  "dessert cake slice",
  "newspaper journalism desk",
  "city skyline night urban",
];

function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
    }
  }
}

async function main() {
  loadEnvFiles();
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) {
    console.error(
      [
        "[fetch:cards] Missing PEXELS_API_KEY (set in frontend/.env.local).",
        "  1) Get a free key: https://www.pexels.com/api/",
        "  2) Add: PEXELS_API_KEY=your_key",
        "  3) Run: npm run fetch:cards",
      ].join("\n"),
    );
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });
  const attributions = [
    "Pexels — https://www.pexels.com/license/",
    "사진가 표기는 감사(필수 아님). 아래는 다운로드 시점 메타데이터입니다.",
    "",
  ];

  for (let i = 0; i < QUERIES.length; i++) {
    const q = QUERIES[i];
    const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=1&orientation=landscape`;
    const res = await fetch(searchUrl, { headers: { Authorization: key } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Pexels 검색 실패 (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const photo = data.photos?.[0];
    if (!photo) throw new Error(`검색 결과 없음: ${q}`);

    const imgUrl = photo.src?.large2x || photo.src?.large || photo.src?.original;
    if (!imgUrl) throw new Error(`이미지 URL 없음: ${q}`);

    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) throw new Error(`이미지 다운로드 실패: ${imgRes.status}`);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const filename = `img${i + 1}.jpg`;
    await writeFile(join(outDir, filename), buf);

    attributions.push(
      `${filename} — ${photo.photographer} — ${photo.photographer_url} — ${photo.url}`,
    );
    process.stdout.write(`  wrote ${filename} (${q})\n`);

    await new Promise((r) => setTimeout(r, 400));
  }

  await writeFile(join(outDir, "ATTRIBUTION.txt"), attributions.join("\n") + "\n");
  console.log("\n완료: public/cards/img1.jpg … img10.jpg 및 ATTRIBUTION.txt");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

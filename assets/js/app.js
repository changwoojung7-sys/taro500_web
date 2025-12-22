// 생년월일 input
const birthInput = document.getElementById("birthdate");

// YYYY → YYYY- → YYYY-MM- → YYYY-MM-DD
if (birthInput) {
  birthInput.addEventListener("input", (e) => {
    let v = e.target.value.replace(/[^0-9]/g, "");

    if (v.length === 4) {
      e.target.value = v + "-";
      return;
    }
    if (v.length === 6) {
      e.target.value = v.slice(0,4) + "-" + v.slice(4,6) + "-";
      return;
    }
    if (v.length >= 8) {
      v = v.slice(0,8);
      e.target.value =
        v.slice(0,4) + "-" +
        v.slice(4,6) + "-" +
        v.slice(6,8);
      return;
    }
    e.target.value = v;
  });
}

// 음력 → 양력
function convertLunarToSolar(dateStr) {
  const [y,m,d] = dateStr.split("-").map(Number);
  const lunar = Lunar.fromYmd(y,m,d);
  const solar = lunar.getSolar();
  return `${solar.getYear()}-${String(solar.getMonth()).padStart(2,"0")}-${String(solar.getDay()).padStart(2,"0")}`;
}

// 버튼
document.getElementById("submitBtn").addEventListener("click", async (e) => {
  e.preventDefault();

  const loading = document.getElementById("loading");
  const resultBox = document.getElementById("resultBox");
  const resultSection = document.getElementById("resultSection");

  loading.style.display = "block";
  resultSection.style.display = "none";
  resultBox.innerText = "";

  let birthdate = birthInput.value;
  const dateType = document.querySelector("input[name=date_type]:checked").value;

  if (dateType === "음력") {
    birthdate = convertLunarToSolar(birthdate);
  }

  const payload = {
    name: document.getElementById("name").value.trim(),
    name_hanja: document.getElementById("name_hanja").value.trim(),
    gender: document.querySelector("input[name=gender]:checked").value,
    date_type: dateType,
    birthdate,
    birthtime: document.getElementById("birthtime").value,
    followup: document.getElementById("followup").value.trim()
  };

  // ✅ payload 만든 다음에 검증
  if (!payload.name || !payload.birthdate) {
    alert("이름과 생년월일은 필수입니다.");
    loading.style.display = "none";
    return;
  }

  try {
    const res = await fetch(
      "https://saju500.onrender.com/api/saju",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || "API 오류");
    }

    const data = await res.json();

    resultBox.innerText = data.result || "결과를 불러오지 못했습니다.";
    resultSection.style.display = "block";

  } catch (err) {
    console.error(err);
    alert("사주 해석 중 오류가 발생했습니다.");
  } finally {
    loading.style.display = "none";
  }
});

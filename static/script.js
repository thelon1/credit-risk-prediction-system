const $ = (id) => document.getElementById(id);
const form = $("form"), btn = $("btn"), result = $("result");

// Auto-calculate loan % of income
function calcPct() {
  const a = parseFloat($("loan_amnt").value), i = parseFloat($("person_income").value);
  $("loan_percent_income").value = a > 0 && i > 0 ? (a / i).toFixed(2) : "";
}
["loan_amnt", "person_income"].forEach((id) => $(id).addEventListener("input", calcPct));
calcPct();

function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 4000);
}

function countUp(el, target, ms = 1600) {
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / ms, 1);
    el.textContent = (target * (1 - Math.pow(1 - p, 3))).toFixed(1);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function showResult(r) {
  const prob = r.default_probability * 100;
  const high = r.default_prediction === 1;
  result.className = "panel result " + (high ? "high" : "low");
  result.dataset.state = "done";
  $("badge").textContent = high ? "⚠ High Risk" : "✓ Low Risk";
  $("verdict").textContent = high
    ? "The estimated default probability exceeds the decision threshold. Manual review or tighter terms are recommended."
    : "The estimated default probability is below the decision threshold. This application looks healthy.";
  $("thrv").textContent = (r.threshold * 100).toFixed(1) + "%";
  $("predv").textContent = high ? "Default (1)" : "No default (0)";

  // reset then animate
  $("arc").style.transition = "none"; $("arc").style.strokeDashoffset = 100;
  $("thr").style.transition = "none"; $("thr").style.transform = "rotate(-90deg)";
  $("pct").textContent = "0.0";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $("arc").style.transition = ""; $("thr").style.transition = "";
    $("arc").style.strokeDashoffset = 100 - Math.min(prob, 100);
    $("thr").style.transform = `rotate(${-90 + 180 * r.threshold}deg)`;
    countUp($("pct"), prob);
  }));
  if (window.innerWidth < 900) result.scrollIntoView({ behavior: "smooth" });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  let valid = true;
  form.querySelectorAll("input:not([readonly])").forEach((inp) => {
    inp.classList.remove("err");
    if (inp.value === "" || Number(inp.value) < Number(inp.min || -Infinity)) {
      inp.classList.add("err"); valid = false;
    }
  });
  if (!valid) return toast("Please fix the highlighted fields.");

  const num = (id) => parseFloat($(id).value);
  const payload = {
    person_age: parseInt($("person_age").value),
    person_income: num("person_income"),
    person_home_ownership: $("person_home_ownership").value,
    person_emp_length: num("person_emp_length"),
    loan_intent: $("loan_intent").value,
    loan_grade: $("loan_grade").value,
    loan_amnt: num("loan_amnt"),
    loan_int_rate: num("loan_int_rate"),
    loan_percent_income: num("loan_percent_income"),
    cb_person_default_on_file: $("cb_person_default_on_file").value,
    cb_person_cred_hist_length: parseInt($("cb_person_cred_hist_length").value),
  };

  btn.classList.add("loading");
  try {
    const res = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Server returned " + res.status);
    showResult(await res.json());
  } catch (err) {
    toast("Prediction failed: " + err.message);
  } finally {
    btn.classList.remove("loading");
  }
});

$("reset").addEventListener("click", () => {
  result.dataset.state = "idle"; result.className = "panel result";
  window.scrollTo({ top: 0, behavior: "smooth" });
});

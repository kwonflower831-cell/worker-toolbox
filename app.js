/* 직장인 필수 계산기 — 모든 계산은 브라우저에서만 이루어지며 입력값은 서버로 전송되지 않습니다. */

// ===== 2026년 기준 상수 (바뀌면 여기만 수정) =====
const RATE = {
  pension: 0.0475,          // 국민연금 근로자 부담 (9.5% 중 절반)
  pensionMin: 410000,       // 기준소득월액 하한 (2026.7~)
  pensionMax: 6590000,      // 기준소득월액 상한 (2026.7~)
  health: 0.03595,          // 건강보험 근로자 부담 (7.19% 중 절반)
  ltc: 0.1314,              // 장기요양: 건강보험료의 13.14%
  employment: 0.009,        // 고용보험 근로자 부담
  localTax: 0.1,            // 지방소득세: 소득세의 10%
  minWage: 10320,           // 2026년 최저시급
  unempMax: 68100,          // 2026년 구직급여 1일 상한액
  unempMin: 66048,          // 2026년 구직급여 1일 하한액 (8시간, 최저임금의 80%)
};

const $ = id => document.getElementById(id);
const won = n => Math.round(n).toLocaleString('ko-KR') + '원';
const floor10 = n => Math.floor(n / 10) * 10;
const num = id => Number($(id).value) || 0;

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1800);
}
async function shareText(text) {
  const full = text + '\n' + location.href;
  if (navigator.share) { try { await navigator.share({ title: document.title, text, url: location.href }); return; } catch {} }
  try { await navigator.clipboard.writeText(full); toast('결과가 복사됐어요! 공유해 보세요'); }
  catch { prompt('복사해서 공유하세요', full); }
}

// ===== 탭 =====
function showTab(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + name));
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  history.replaceState(null, '', '#' + name);
}
document.querySelectorAll('nav.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
showTab(['salary', 'severance', 'hourly', 'reverse', 'annualleave', 'unemp'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'salary');

// ===== 1) 연봉 실수령액 =====
function taxBase(tp) { // 과세표준 → 산출세액 (종합소득세율)
  const br = [[14e6, .06], [50e6, .15], [88e6, .24], [150e6, .35], [300e6, .38], [500e6, .40], [1e9, .42], [Infinity, .45]];
  let tax = 0, prev = 0;
  for (const [lim, r] of br) { if (tp > prev) tax += (Math.min(tp, lim) - prev) * r; prev = lim; }
  return tax;
}
function earnedDeduction(p) {
  let d;
  if (p <= 5e6) d = p * .7;
  else if (p <= 15e6) d = 3.5e6 + (p - 5e6) * .4;
  else if (p <= 45e6) d = 7.5e6 + (p - 15e6) * .15;
  else if (p <= 100e6) d = 12e6 + (p - 45e6) * .05;
  else d = 14.75e6 + (p - 100e6) * .02;
  return Math.min(d, 20e6);
}
function earnedCredit(tax, pay) {
  let c = tax <= 1.3e6 ? tax * .55 : 715000 + (tax - 1.3e6) * .3;
  let lim;
  if (pay <= 33e6) lim = 740000;
  else if (pay <= 70e6) lim = Math.max(740000 - (pay - 33e6) * .008, 660000);
  else if (pay <= 120e6) lim = Math.max(660000 - (pay - 70e6) * .5, 500000);
  else lim = Math.max(500000 - (pay - 120e6) * .5, 200000);
  return Math.min(c, lim);
}
function calcSalary(annual, nonTaxM, deps, kids) {
  const grossM = annual / 12;
  const taxM = Math.max(0, grossM - nonTaxM);
  const pension = floor10(Math.min(Math.max(taxM, RATE.pensionMin), RATE.pensionMax) * RATE.pension);
  const health = floor10(taxM * RATE.health);
  const ltc = floor10(health * RATE.ltc);
  const emp = floor10(taxM * RATE.employment);
  const pay = Math.max(0, annual - nonTaxM * 12);
  const income = pay - earnedDeduction(pay);
  const ded = deps * 1.5e6 + pension * 12 + (health + ltc + emp) * 12;
  const base = Math.max(0, income - ded);
  const calc = taxBase(base);
  let credit = earnedCredit(calc, pay) + 130000;
  if (kids >= 1) credit += kids === 1 ? 250000 : 550000 + (kids - 2) * 400000;
  const incomeTax = floor10(Math.max(0, calc - credit) / 12);
  const local = floor10(incomeTax * RATE.localTax);
  const totalDed = pension + health + ltc + emp + incomeTax + local;
  return { grossM, pension, health, ltc, emp, incomeTax, local, totalDed, net: grossM - totalDed };
}
let lastSalary = '';
$('salaryBtn').onclick = () => {
  const annual = num('annual') * 10000;
  if (annual <= 0) return toast('연봉을 입력해 주세요');
  const r = calcSalary(annual, num('nonTax') * 10000, Math.max(1, num('deps')), num('kids'));
  const items = [['국민연금', r.pension, '#3b6cff'], ['건강보험', r.health, '#12b76a'], ['장기요양', r.ltc, '#7c4dff'],
    ['고용보험', r.emp, '#f79009'], ['소득세', r.incomeTax, '#f04438'], ['지방소득세', r.local, '#98a2b3']];
  $('sNet').textContent = won(r.net);
  $('sRows').innerHTML = `<div class="row"><span>월 급여(세전)</span><span>${won(r.grossM)}</span></div>` +
    items.map(i => `<div class="row"><span>${i[0]}</span><span>-${won(i[1])}</span></div>`).join('') +
    `<div class="row"><b>공제 합계</b><b>-${won(r.totalDed)}</b></div>`;
  $('sBar').innerHTML = items.map(i => `<i style="width:${i[1] / r.totalDed * 100}%;background:${i[2]}"></i>`).join('');
  $('sLegend').innerHTML = items.map(i => `<span><b style="background:${i[2]}"></b>${i[0]}</span>`).join('');
  const hourly = r.net / 209, perDay = r.net / 21.7;
  $('sChips').innerHTML =
    `<span class="chip">🕒 실수령 시급 약 ${won(hourly)}</span>` +
    `<span class="chip">📅 하루 약 ${won(perDay)}</span>` +
    `<span class="chip">⏱ 1분에 약 ${won(hourly / 60)}</span>` +
    `<span class="chip">💸 공제율 ${(r.totalDed / r.grossM * 100).toFixed(1)}%</span>` +
    `<span class="chip">📆 연 실수령 약 ${won(r.net * 12)}</span>`;
  $('sResult').classList.add('show');
  lastSalary = `연봉 ${num('annual').toLocaleString()}만원 → 월 실수령액 약 ${won(r.net)} (공제 ${(r.totalDed / r.grossM * 100).toFixed(1)}%)`;
};
$('salaryShare').onclick = () => shareText('💰 ' + lastSalary);

// ===== 2) 퇴직금 =====
let lastSev = '';
$('sevBtn').onclick = () => {
  const s = new Date($('joinDate').value), e = new Date($('leaveDate').value);
  if (isNaN(s) || isNaN(e) || e < s) return toast('입사일/퇴사일을 확인해 주세요');
  const days = Math.round((e - s) / 864e5) + 1;
  const wage3 = num('wage3') * 10000, bonus = num('bonus') * 10000, leave = num('leavePay') * 10000;
  const d3 = num('days3') || 92;
  if (wage3 <= 0) return toast('최근 3개월 급여를 입력해 주세요');
  const avgDay = (wage3 + bonus * 3 / 12 + leave * 3 / 12) / d3;
  const sev = days >= 365 ? avgDay * 30 * days / 365 : 0;
  $('vBig').textContent = days >= 365 ? won(sev) : '지급 대상 아님';
  $('vRows').innerHTML =
    `<div class="row"><span>재직일수</span><span>${days.toLocaleString()}일 (${(days / 365).toFixed(2)}년)</span></div>` +
    `<div class="row"><span>1일 평균임금</span><span>${won(avgDay)}</span></div>` +
    `<div class="row"><span>계산식</span><span>평균임금 × 30일 × 재직일수 ÷ 365</span></div>` +
    (days < 365 ? `<div class="row"><span class="no">계속 근로 1년 미만은 법정 퇴직금 대상이 아니에요</span><span></span></div>` : '');
  $('vResult').classList.add('show');
  lastSev = days >= 365 ? `재직 ${(days / 365).toFixed(1)}년, 예상 퇴직금 약 ${won(sev)}` : '재직 1년 미만이라 법정 퇴직금 대상이 아니래요';
};
$('sevShare').onclick = () => shareText('🧾 ' + lastSev);

// ===== 3) 시급·주휴수당·최저임금 =====
let lastHourly = '';
$('hourBtn').onclick = () => {
  const w = num('wage'), h = num('weekHours');
  if (w <= 0 || h <= 0) return toast('시급과 주 근로시간을 입력해 주세요');
  const holiday = h >= 15 ? Math.min(h, 40) / 40 * 8 : 0;
  const monthHours = Math.round((h + holiday) * 365 / 7 / 12); // 주 40h 기준 209시간(고용노동부 환산 기준)
  const monthly = monthHours * w;
  const ok = w >= RATE.minWage;
  $('hBig').textContent = won(monthly);
  $('hRows').innerHTML =
    `<div class="row"><span>주휴시간</span><span>주 ${holiday.toFixed(1)}시간 (주 15시간 이상 근무 시 발생)</span></div>` +
    `<div class="row"><span>주휴수당</span><span>주 ${won(holiday * w)}</span></div>` +
    `<div class="row"><span>월 환산 근로시간</span><span>${monthHours}시간</span></div>` +
    `<div class="row"><span>연봉 환산(세전)</span><span>${won(monthly * 12)}</span></div>` +
    `<div class="row"><span>2026 최저시급(${RATE.minWage.toLocaleString()}원) 대비</span><span class="${ok ? 'ok' : 'no'}">${ok ? '✔ 충족' : '✖ 미달 ' + won(RATE.minWage - w) + ' 부족'}</span></div>`;
  $('hResult').classList.add('show');
  lastHourly = `시급 ${w.toLocaleString()}원, 주 ${h}시간 → 주휴수당 포함 월급 약 ${won(monthly)}${ok ? '' : ' (최저시급 미달!)'}`;
};
$('hourShare').onclick = () => shareText('⏰ ' + lastHourly);

// 기본값
$('leaveDate').value = new Date().toISOString().slice(0, 10);

// ===== 4) 실수령액 → 연봉 역산 =====
let lastRev = '';
$('revBtn').onclick = () => {
  const target = num('rNet') * 10000;
  if (target <= 0) return toast('목표 실수령액을 입력해 주세요');
  const nt = num('rNonTax') * 10000, deps = Math.max(1, num('rDeps')), kids = num('rKids');
  let lo = 1e6, hi = 2e9;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (calcSalary(mid, nt, deps, kids).net < target) lo = mid; else hi = mid;
  }
  const annual = Math.ceil(hi / 10000) * 10000;
  const r = calcSalary(annual, nt, deps, kids);
  $('rBig').textContent = won(annual);
  $('rRows').innerHTML =
    `<div class="row"><span>월 급여(세전)</span><span>${won(annual / 12)}</span></div>` +
    `<div class="row"><span>월 실수령액(추정)</span><span>${won(r.net)}</span></div>` +
    `<div class="row"><span>월 공제 합계</span><span>-${won(r.totalDed)}</span></div>` +
    `<div class="row"><span>연봉 대비 실수령 비율</span><span>${(r.net * 12 / annual * 100).toFixed(1)}%</span></div>`;
  $('rResult').classList.add('show');
  lastRev = `월 ${num('rNet').toLocaleString()}만원을 받으려면 세전 연봉 약 ${Math.round(annual / 10000).toLocaleString()}만원이 필요해요`;
};
$('revShare').onclick = () => shareText('🔁 ' + lastRev);

// ===== 5) 연차수당 =====
let lastAl = '';
$('alBtn').onclick = () => {
  const m = num('alMonthly') * 10000, d = num('alDays'), dh = num('alHours') || 8, mh = num('alMonthHours') || 209;
  if (m <= 0 || d <= 0) return toast('통상임금과 연차 일수를 입력해 주세요');
  const hourly = m / mh, daily = hourly * dh, total = daily * d;
  $('aBig').textContent = won(total);
  $('aRows').innerHTML =
    `<div class="row"><span>통상시급</span><span>${won(hourly)}</span></div>` +
    `<div class="row"><span>1일 통상임금</span><span>${won(daily)}</span></div>` +
    `<div class="row"><span>계산식</span><span>${won(daily)} × ${d}일</span></div>`;
  $('aResult').classList.add('show');
  lastAl = `미사용 연차 ${d}일 → 연차수당 약 ${won(total)}`;
};
$('alShare').onclick = () => shareText('🏖 ' + lastAl);

// ===== 6) 실업급여 (구직급여) =====
const UNEMP_DAYS = [[120, 120], [150, 180], [180, 210], [210, 240], [240, 270]];
let lastUn = '';
$('uBtn').onclick = () => {
  const w = num('uWage3') * 10000, d3 = num('uDays3') || 92;
  if (w <= 0) return toast('최근 3개월 임금을 입력해 주세요');
  const avg = w / d3;
  const raw = avg * 0.6;
  const daily = Math.min(Math.max(raw, RATE.unempMin), RATE.unempMax);
  const days = UNEMP_DAYS[Number($('uPeriod').value)][Number($('uAge').value)];
  const total = daily * days;
  $('uBig').textContent = won(total);
  $('uRows').innerHTML =
    `<div class="row"><span>1일 평균임금</span><span>${won(avg)}</span></div>` +
    `<div class="row"><span>구직급여 일액 (평균임금의 60%)</span><span>${won(raw)}</span></div>` +
    `<div class="row"><span>적용 일액 (하한 ${RATE.unempMin.toLocaleString()} ~ 상한 ${RATE.unempMax.toLocaleString()}원)</span><span>${won(daily)}</span></div>` +
    `<div class="row"><span>소정급여일수</span><span>${days}일</span></div>` +
    `<div class="row"><span>월 환산(30일)</span><span>${won(daily * 30)}</span></div>` +
    `<div class="row"><span class="no">비자발적 퇴사 등 수급 요건 충족이 전제예요</span><span></span></div>`;
  $('uResult').classList.add('show');
  lastUn = `실업급여 하루 약 ${won(daily)} × ${days}일 = 총 약 ${won(total)}`;
};
$('uShare').onclick = () => shareText('🛟 ' + lastUn);
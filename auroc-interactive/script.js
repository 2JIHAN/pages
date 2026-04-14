function erf(x) {
  const s = x >= 0 ? 1 : -1, a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429*t - 1.453152027)*t) + 1.421413741)*t - 0.284496736)*t + 0.254829592)*t * Math.exp(-a*a);
  return s * y;
}

function normCDF(x, mu, sg) { return 0.5 * (1 + erf((x - mu) / (sg * Math.SQRT2))); }

const N = 1000000, MUN = 0.35, SG = 0.15;
const MU_CLEAR = 0.65, MU_BORDER = 0.45;

let kProp = 1.0;
let currentT = 0.5;
const GC = 'rgba(0,0,0,0.06)';
const TC = 'rgba(90,98,112,0.9)';

function getStats(t, k) {
  if (k === undefined) k = kProp;
  const tpr = k * (1 - normCDF(t, MU_CLEAR, SG)) + (1 - k) * (1 - normCDF(t, MU_BORDER, SG));
  const fpr = 1 - normCDF(t, MUN, SG);
  const tp = Math.round(N * tpr), fn = N - tp;
  const fp = Math.round(N * fpr), tn = N - fp;
  return { tp, fn, fp, tn, tpr, fpr, specificity: 1 - fpr, precision: (tp + fp) > 0 ? tp / (tp + fp) : null };
}

function computeROC(k) {
  const data = [];
  for (let i = 0; i <= 400; i++) {
    const s = getStats(i / 400, k);
    data.push({ x: s.fpr, y: s.tpr });
  }
  data.sort((a, b) => a.x - b.x);
  let auc = 0;
  for (let i = 1; i < data.length; i++)
    auc += (data[i].x - data[i-1].x) * (data[i].y + data[i-1].y) / 2;
  return { data, auc };
}

function rrect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y);
  c.closePath();
}

const labelPlugin = {
  id: 'lp',
  afterDraw(ch) {
    const meta = ch.getDatasetMeta(2);
    if (!meta.data.length) return;
    const pt = meta.data[0];
    const s = getStats(currentT, kProp);
    const lines = [
      `T = ${currentT.toFixed(2)}`,
      `TPR = ${(s.tpr*100).toFixed(1)}%`,
      `FPR = ${(s.fpr*100).toFixed(1)}%`
    ];
    const c = ch.ctx; c.save();
    c.font = '600 11px ' + "'SF Mono','Consolas',monospace";
    const lh = 14, pd = 7, bw = 88, bh = lines.length * lh + pd * 2;
    const ca = ch.chartArea;
    const px = pt.x, py = pt.y;
    const bx = s.fpr < 0.55
      ? Math.min(ca.right - bw - 2, px + 13)
      : Math.max(ca.left + 2, px - bw - 13);
    const by = Math.max(ca.top + 2, Math.min(ca.bottom - bh - 2, py - bh / 2));
    c.fillStyle = 'rgba(255,253,251,0.97)';
    c.strokeStyle = '#c05030'; c.lineWidth = 1.5;
    rrect(c, bx, by, bw, bh, 6); c.fill(); c.stroke();
    c.fillStyle = '#a84020';
    c.textBaseline = 'top';
    lines.forEach((l, i) => c.fillText(l, bx + pd, by + pd + i * lh));
    c.restore();
  }
};

let rocChart;

function initChart(rocData) {
  rocChart = new Chart(document.getElementById('roc'), {
    type: 'scatter',
    plugins: [labelPlugin],
    data: {
      datasets: [
        {
          label: 'ROC Curve',
          data: rocData, type: 'line',
          borderColor: '#3b82f6', // Tailwind blue-500
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true, borderWidth: 2.5, pointRadius: 0, tension: 0.12, order: 3
        },
        {
          label: 'Random',
          data: [{x:0,y:0},{x:1,y:1}], type: 'line',
          borderColor: 'rgba(100,110,125,0.3)',
          borderDash: [5, 4], borderWidth: 1.5,
          pointRadius: 0, fill: false, order: 4
        },
        {
          label: 'Threshold',
          data: [{x: 0, y: 0}], type: 'scatter',
          backgroundColor: '#f97316', // Tailwind orange-500
          borderColor: '#ffffff',
          borderWidth: 2.5, pointRadius: 9, pointHoverRadius: 11, order: 1
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 0 },
      scales: {
        x: {
          min: 0, max: 1,
          title: { display: true, text: 'FPR (1 − Specificity)', color: TC, font: { size: 11 } },
          ticks: { color: TC, font: { size: 11 }, maxTicksLimit: 6 },
          grid: { color: GC },
          border: { color: 'rgba(0,0,0,0.1)' }
        },
        y: {
          min: 0, max: 1,
          title: { display: true, text: 'TPR (Sensitivity)', color: TC, font: { size: 11 } },
          ticks: { color: TC, font: { size: 11 }, maxTicksLimit: 6 },
          grid: { color: GC },
          border: { color: 'rgba(0,0,0,0.1)' }
        }
      },
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

function updateUI(t, k) {
  if (k !== undefined) kProp = k;
  currentT = t;
  const s = getStats(t, kProp);
  document.getElementById('tp').textContent = s.tp.toLocaleString();
  document.getElementById('fn').textContent = s.fn.toLocaleString();
  document.getElementById('fp').textContent = s.fp.toLocaleString();
  document.getElementById('tn').textContent = s.tn.toLocaleString();
  document.getElementById('val-precision').textContent  = s.precision !== null ? (s.precision * 100).toFixed(1) + '%' : '—';
  document.getElementById('val-sensitivity').textContent = (s.tpr * 100).toFixed(1) + '%';
  document.getElementById('val-specificity').textContent = (s.specificity * 100).toFixed(1) + '%';
  document.getElementById('val-fpr').textContent         = (s.fpr * 100).toFixed(1) + '%';
  document.getElementById('thresh-val').textContent      = t.toFixed(2);
  
  if (k !== undefined) {
    const { data, auc } = computeROC(k);
    rocChart.data.datasets[0].data = data;
    document.getElementById('auroc-val').textContent = auc.toFixed(3);
  }
  
  rocChart.data.datasets[2].data = [{ x: s.fpr, y: s.tpr }];
  rocChart.update('none');
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  const { data: rocData, auc: initAuroc } = computeROC(1.0);
  document.getElementById('auroc-val').textContent = initAuroc.toFixed(3);
  
  initChart(rocData);

  document.getElementById('thresh').addEventListener('input', e => {
    updateUI(parseFloat(e.target.value));
  });

  document.getElementById('clear-slider').addEventListener('input', e => {
    const clearN = parseInt(e.target.value);
    const k = clearN / 1000000;
    document.getElementById('clear-val').textContent   = clearN.toLocaleString();
    document.getElementById('clear-count').textContent = clearN.toLocaleString();
    document.getElementById('border-count').textContent = (1000000 - clearN).toLocaleString();
    document.getElementById('clear-bar').style.width   = (k * 100) + '%';
    updateUI(currentT, k);
  });

  updateUI(0.5);
});

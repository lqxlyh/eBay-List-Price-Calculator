function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = URL.createObjectURL(file);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const uploadPlaceholder = document.getElementById('uploadPlaceholder');
  const uploadPreview = document.getElementById('uploadPreview');
  const previewImg = document.getElementById('previewImg');
  const btnRemove = document.getElementById('btnRemove');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const loading = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const results = document.getElementById('results');
  const identificationCard = document.getElementById('identificationCard');
  const pricingCard = document.getElementById('pricingCard');
  const copyTitleEl = document.getElementById('copyTitle');
  const copyPriceEl = document.getElementById('copyPrice');
  const copyDescEl = document.getElementById('copyDesc');
  const copyAllBtn = document.getElementById('copyAllBtn');

  let currentImageBase64 = null;
  let lastResult = null;

  function getFunctionUrl() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '/.netlify/functions/resell-assistant';
    }
    return '/.netlify/functions/resell-assistant';
  }

  uploadZone.addEventListener('click', (e) => {
    if (!e.target.closest('.btn-remove')) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    try {
      const dataUrl = await compressImage(file, 1200, 0.8);
      currentImageBase64 = dataUrl.split(',')[1] || dataUrl;
      previewImg.src = dataUrl;
      uploadPlaceholder.hidden = true;
      uploadPreview.hidden = false;
      analyzeBtn.disabled = false;
      errorEl.hidden = true;
      results.hidden = true;
    } catch (err) {
      console.error(err);
    }
  });

  btnRemove.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.value = '';
    currentImageBase64 = null;
    previewImg.src = '';
    uploadPlaceholder.hidden = false;
    uploadPreview.hidden = true;
    analyzeBtn.disabled = true;
    results.hidden = true;
    errorEl.hidden = true;
  });

  function setLoading(on) {
    loading.hidden = !on;
    analyzeBtn.disabled = on;
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    setLoading(false);
  }

  analyzeBtn.addEventListener('click', async () => {
    if (!currentImageBase64) return;

    setLoading(true);
    errorEl.hidden = true;
    results.hidden = true;

    try {
      const res = await fetch(getFunctionUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: currentImageBase64 }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || `Error ${res.status}`);
        return;
      }

      lastResult = data;
      renderResults(data);
      results.hidden = false;
    } catch (err) {
      showError(err.message || 'Request failed. Make sure the app is deployed on Netlify with OPENAI_API_KEY set.');
    } finally {
      setLoading(false);
    }
  });

  function renderResults(data) {
    const { identification, pricing, listing } = data;

    identificationCard.innerHTML = `
      <p><strong>${escapeHtml(identification.itemName || 'Unknown')}</strong></p>
      ${identification.brand || identification.model || identification.year ? `
        <p class="muted">${[identification.brand, identification.model, identification.year].filter(Boolean).join(' • ') || ''}</p>
      ` : ''}
      ${identification.condition ? `<p>Condition: <strong>${escapeHtml(identification.condition)}</strong></p>` : ''}
      ${identification.sellingPoints?.length ? `
        <p class="muted">Key points: ${identification.sellingPoints.map(s => escapeHtml(s)).join(', ')}</p>
      ` : ''}
    `;

    const qs = pricing.quickSellPrice;
    const np = pricing.normalPrice;
    const mx = pricing.maxPrice;

    pricingCard.innerHTML = `
      <p class="muted">FB range: ${escapeHtml(pricing.fbPriceRange || '—')} | eBay avg: ${escapeHtml(pricing.eBayAverage || '—')}</p>
      ${pricing.offerUpNote ? `<p class="muted">${escapeHtml(pricing.offerUpNote)}</p>` : ''}
      <div class="price-tiers">
        <div class="price-tier quick">
          <span class="tier-label">Quick sell</span>
          <span class="tier-value">$${qs?.amount ?? '—'}</span>
          ${qs?.reason ? `<span class="tier-reason">${escapeHtml(qs.reason)}</span>` : ''}
        </div>
        <div class="price-tier normal">
          <span class="tier-label">Normal</span>
          <span class="tier-value">$${np?.amount ?? '—'}</span>
          ${np?.reason ? `<span class="tier-reason">${escapeHtml(np.reason)}</span>` : ''}
        </div>
        <div class="price-tier max">
          <span class="tier-label">Max</span>
          <span class="tier-value">$${mx?.amount ?? '—'}</span>
          ${mx?.reason ? `<span class="tier-reason">${escapeHtml(mx.reason)}</span>` : ''}
        </div>
      </div>
    `;

    const normalAmount = np?.amount ?? qs?.amount ?? 0;
    copyTitleEl.textContent = listing?.title || (identification.itemName ? `${identification.itemName} - ${identification.condition || 'Used'}` : '');
    copyPriceEl.textContent = `$${normalAmount}`;
    copyDescEl.textContent = listing?.description || '';
  }

  function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const prev = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove('copied');
      }, 1500);
    });
  }

  document.querySelectorAll('.btn-copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const which = btn.dataset.copy;
      const text = which === 'title' ? copyTitleEl.textContent
        : which === 'price' ? copyPriceEl.textContent
        : copyDescEl.textContent;
      copyToClipboard(text, btn);
    });
  });

  copyAllBtn.addEventListener('click', () => {
    const title = copyTitleEl.textContent;
    const price = copyPriceEl.textContent;
    const desc = copyDescEl.textContent;
    const all = `Title: ${title}\n\nPrice: ${price}\n\nDescription:\n${desc}`;
    copyToClipboard(all, copyAllBtn);
  });
});

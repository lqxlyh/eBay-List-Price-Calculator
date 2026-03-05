document.addEventListener('DOMContentLoaded', () => {
  const costInput = document.getElementById('cost');
  const profitInput = document.getElementById('profit');
  const profitUnitEl = document.getElementById('profitUnit');
  const profitHintEl = document.getElementById('profitHint');
  const shippingInput = document.getElementById('shipping');
  const taxRateInput = document.getElementById('taxRate');
  const transactionFeeInput = document.getElementById('transactionFee');
  const adFeeInput = document.getElementById('adFee');
  const calSaleAmountInput = document.getElementById('calSaleAmount');
  const calFeesInput = document.getElementById('calFees');
  const applyCalibrationBtn = document.getElementById('applyCalibration');
  const calibrationResultEl = document.getElementById('calibrationResult');
  const calculateBtn = document.getElementById('calculate');
  const listPriceEl = document.getElementById('listPrice');
  const breakdownEl = document.getElementById('resultBreakdown');

  function formatCurrency(num) {
    return '$' + Number(num).toFixed(2);
  }

  function calibrateAndApply() {
    const saleAmount = parseFloat(calSaleAmountInput.value) || 0;
    const fees = parseFloat(calFeesInput.value) || 0;

    if (saleAmount <= 0 || fees < 0) {
      calibrationResultEl.textContent = 'Please enter order total and transaction fees';
      calibrationResultEl.className = 'calibration-result error';
      return;
    }

    const effectiveRate = (fees / saleAmount) * 100;
    transactionFeeInput.value = effectiveRate.toFixed(2);
    calibrationResultEl.textContent = `Your transaction fee rate: ${effectiveRate.toFixed(2)}% (on order total including tax). Applied to Transaction Fee Rate.`;
    calibrationResultEl.className = 'calibration-result success';
  }

  function updateProfitModeUI() {
    const isPercent = document.querySelector('input[name="profitMode"]:checked').value === 'percent';
    profitUnitEl.textContent = isPercent ? '%' : '$';
    profitInput.placeholder = isPercent ? '20' : '0.00';
    profitHintEl.textContent = isPercent ? 'Profit as % of list price' : 'Desired profit amount';
  }

  document.querySelectorAll('input[name="profitMode"]').forEach((radio) => {
    radio.addEventListener('change', updateProfitModeUI);
  });

  function calculate() {
    const cost = parseFloat(costInput.value) || 0;
    const shipping = parseFloat(shippingInput.value) || 0;
    const isPercentMode = document.querySelector('input[name="profitMode"]:checked').value === 'percent';
    const profitInputVal = parseFloat(profitInput.value) || 0;
    const taxRatePct = (parseFloat(taxRateInput.value) || 0) / 100;
    const transactionFeePct = (parseFloat(transactionFeeInput.value) || 0) / 100;
    const adFeePct = (parseFloat(adFeeInput.value) || 0) / 100;

    const totalFeePct = transactionFeePct + adFeePct;
    const feeMultiplier = 1 + taxRatePct;
    if (totalFeePct * feeMultiplier >= 1) {
      listPriceEl.textContent = 'Invalid fee rate';
      breakdownEl.innerHTML = '<p>Please check tax and fee settings</p>';
      return;
    }

    let listPrice;
    if (isPercentMode) {
      const marginPct = profitInputVal / 100;
      if (marginPct + totalFeePct * feeMultiplier >= 1) {
        listPriceEl.textContent = 'Margin + fees cannot ≥ 100%';
        breakdownEl.innerHTML = '<p>Lower target margin or check fee settings</p>';
        return;
      }
      listPrice = (cost + shipping) / (1 - marginPct - totalFeePct * feeMultiplier);
    } else {
      listPrice = (profitInputVal + cost + shipping) / (1 - totalFeePct * feeMultiplier);
    }
    const orderTotal = listPrice * (1 + taxRatePct);
    const transactionFeeAmount = orderTotal * transactionFeePct;
    const adFeeAmount = orderTotal * adFeePct;
    const netRevenue = listPrice - transactionFeeAmount - adFeeAmount - shipping;
    const actualProfit = netRevenue - cost;

    listPriceEl.textContent = formatCurrency(listPrice);

    let breakdownHTML = ``;
    if (taxRatePct > 0) {
      breakdownHTML += `<div class="row"><span>Order total (incl. tax)</span><strong>${formatCurrency(orderTotal)}</strong></div>`;
    }
    breakdownHTML += `
      <div class="row"><span>Transaction fees</span><strong>${formatCurrency(transactionFeeAmount)}</strong></div>
    `;
    if (adFeePct > 0) {
      breakdownHTML += `<div class="row"><span>Promoted Listings fee</span><strong>${formatCurrency(adFeeAmount)}</strong></div>`;
    }
    breakdownHTML += `
      <div class="row"><span>Shipping cost</span><strong>${formatCurrency(shipping)}</strong></div>
      <div class="row"><span>Item cost</span><strong>${formatCurrency(cost)}</strong></div>
      <div class="row"><span>Net profit</span><strong>${formatCurrency(actualProfit)}</strong></div>
    `;
    breakdownEl.innerHTML = breakdownHTML;
  }

  applyCalibrationBtn.addEventListener('click', calibrateAndApply);
  calculateBtn.addEventListener('click', calculate);

  [costInput, profitInput, shippingInput].forEach((input) => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') calculate();
    });
  });
});

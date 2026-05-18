const STORAGE_KEY = 'calc.saved';

const CURRENCY_SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$',
    CHF: 'Fr ', CNY: '¥', INR: '₹', NZD: 'NZ$', SEK: 'kr ', NOK: 'kr ',
    DKK: 'kr ', ZAR: 'R', BRL: 'R$', MXN: 'Mex$', SGD: 'S$', HKD: 'HK$', KRW: '₩',
};

const FREQ_PER_YEAR = { monthly: 12, biweekly: 26, weekly: 52 };
const FREQ_LABEL = { monthly: 'Monthly', biweekly: 'Bi-weekly', weekly: 'Weekly' };

let lastResult = null;

function fmt(currency, value) {
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        const sym = CURRENCY_SYMBOLS[currency] || '';
        return `${sym}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}

function getFormValues() {
    return {
        currency: document.getElementById('currency').value,
        price: parseFloat(document.getElementById('price').value) || 0,
        deposit: parseFloat(document.getElementById('deposit').value) || 0,
        rate: parseFloat(document.getElementById('rate').value) || 0,
        years: parseInt(document.getElementById('years').value, 10) || 0,
        months: parseInt(document.getElementById('months').value, 10) || 0,
        paymentFreq: document.getElementById('paymentFreq').value,
        balloon: parseFloat(document.getElementById('balloon').value) || 0,
        docFee: parseFloat(document.getElementById('docFee').value) || 0,
        optionFee: parseFloat(document.getElementById('optionFee').value) || 0,
    };
}

function calculate(v) {
    const perYear = FREQ_PER_YEAR[v.paymentFreq];
    const totalMonths = v.years * 12 + v.months;
    const n = Math.round((totalMonths / 12) * perYear);

    const financed = Math.max(0, v.price - v.deposit);
    const i = (v.rate / 100) / perYear;
    const B = Math.min(v.balloon, financed);

    let payment = 0;
    if (n > 0) {
        if (i === 0) {
            payment = (financed - B) / n;
        } else {
            const growth = Math.pow(1 + i, n);
            payment = (financed * growth - B) * i / (growth - 1);
        }
    }

    const schedule = [];
    let balance = financed;
    let totalInterest = 0;
    let totalPaid = 0;

    for (let k = 1; k <= n; k++) {
        const interestPart = balance * i;
        let principalPart = payment - interestPart;
        if (k === n) {
            principalPart = balance - B;
            payment = principalPart + interestPart;
        }
        balance -= principalPart;
        totalInterest += interestPart;
        totalPaid += payment;
        schedule.push({ period: k, payment, interest: interestPart, principal: principalPart, balance });
    }

    totalPaid += B;
    balance -= B;

    const yearly = [];
    let yPaid = 0, yInterest = 0, yPrincipal = 0;
    let lastBalAtYear = financed;
    for (let k = 0; k < schedule.length; k++) {
        const row = schedule[k];
        yPaid += row.payment;
        yInterest += row.interest;
        yPrincipal += row.principal;
        const isYearEnd = ((k + 1) % perYear === 0) || k === schedule.length - 1;
        if (isYearEnd) {
            const yearNum = Math.ceil((k + 1) / perYear);
            const partial = (k + 1) !== yearNum * perYear;
            yearly.push({
                year: yearNum,
                paid: yPaid,
                interest: yInterest,
                principal: yPrincipal,
                balance: row.balance,
                partial,
            });
            yPaid = 0; yInterest = 0; yPrincipal = 0;
            lastBalAtYear = row.balance;
        }
    }

    if (B > 0 && yearly.length > 0) {
        const last = yearly[yearly.length - 1];
        last.paid += B;
        last.principal += B;
        last.balance = 0;
    }

    const fees = v.docFee + v.optionFee;
    const totalCost = v.deposit + totalPaid + fees;

    return {
        periodicPayment: schedule.length ? schedule[0].payment : 0,
        finalPayment: schedule.length ? schedule[schedule.length - 1].payment + B : B,
        n,
        amountFinanced: financed,
        totalInterest,
        totalPaid,
        totalCost,
        fees,
        balloon: B,
        yearly,
    };
}

function renderResult(v, result) {
    document.getElementById('resultEmpty').hidden = true;
    document.getElementById('resultContent').hidden = false;

    document.getElementById('paymentLabel').textContent = `${FREQ_LABEL[v.paymentFreq]} Payment`;
    document.getElementById('periodicPayment').textContent = fmt(v.currency, result.periodicPayment);
    document.getElementById('totalCost').textContent = fmt(v.currency, result.totalCost);
    document.getElementById('totalInterest').textContent = fmt(v.currency, result.totalInterest);
    document.getElementById('amountFinanced').textContent = fmt(v.currency, result.amountFinanced);
    document.getElementById('balloonShown').textContent = result.balloon > 0
        ? fmt(v.currency, result.balloon)
        : '—';

    const tbody = document.querySelector('#breakdownTable tbody');
    tbody.innerHTML = '';
    for (const row of result.yearly) {
        const tr = document.createElement('tr');
        const yLabel = row.partial ? `${row.year} (partial)` : `Year ${row.year}`;
        tr.innerHTML = `
            <td>${yLabel}</td>
            <td>${fmt(v.currency, row.paid)}</td>
            <td>${fmt(v.currency, row.interest)}</td>
            <td>${fmt(v.currency, row.principal)}</td>
            <td>${fmt(v.currency, row.balance)}</td>
        `;
        tbody.appendChild(tr);
    }

    document.getElementById('saveBtn').disabled = false;
}

function buildSaveEntry(v, result) {
    const durLabel = `${v.years}y ${v.months}m`;
    const balloonLabel = result.balloon > 0 ? `, balloon ${fmt(v.currency, result.balloon)}` : '';
    return {
        title: `${fmt(v.currency, v.price)} car @ ${v.rate}% · ${durLabel}`,
        source: 'car-loan',
        expression: `price ${fmt(v.currency, v.price)}, deposit ${fmt(v.currency, v.deposit)}, ${v.rate}% APR, ${durLabel}, ${FREQ_LABEL[v.paymentFreq].toLowerCase()}${balloonLabel}`,
        result: `${fmt(v.currency, result.periodicPayment)}/${v.paymentFreq.slice(0, 2)} · total ${fmt(v.currency, result.totalCost)}`,
        inputs: v,
    };
}

async function saveResult() {
    if (!lastResult) return;
    const entry = buildSaveEntry(lastResult.v, lastResult.result);
    const label = await window.promptModal({
        title: 'Save Calculation',
        label: 'Name or description',
        defaultValue: entry.title,
        placeholder: 'e.g. Tesla Model 3 finance',
        okText: 'Save',
    });
    if (label === null) return;
    const trimmed = label.trim();
    if (trimmed) entry.title = trimmed;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const items = raw ? JSON.parse(raw) : [];
        const arr = Array.isArray(items) ? items : [];
        arr.unshift({
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            ...entry,
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        const btn = document.getElementById('saveBtn');
        const original = btn.textContent;
        btn.textContent = 'Saved ✓';
        btn.disabled = true;
        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1500);
    } catch (e) {
        alert('Could not save: ' + e.message);
    }
}

document.getElementById('cl-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = getFormValues();
    if (v.price - v.deposit <= 0) {
        alert('Deposit must be less than vehicle price.');
        return;
    }
    if (v.years === 0 && v.months === 0) {
        alert('Enter a loan term.');
        return;
    }
    const result = calculate(v);
    lastResult = { v, result };
    renderResult(v, result);
});

document.getElementById('cl-form').addEventListener('reset', () => {
    setTimeout(() => {
        document.getElementById('resultContent').hidden = true;
        document.getElementById('resultEmpty').hidden = false;
        document.getElementById('saveBtn').disabled = true;
        lastResult = null;
    }, 0);
});

document.getElementById('saveBtn').addEventListener('click', saveResult);

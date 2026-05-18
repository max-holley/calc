const STORAGE_KEY = 'calc.saved';

const CURRENCY_SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$',
    CHF: 'Fr ', CNY: '¥', INR: '₹', NZD: 'NZ$', SEK: 'kr ', NOK: 'kr ',
    DKK: 'kr ', ZAR: 'R', BRL: 'R$', MXN: 'Mex$', SGD: 'S$', HKD: 'HK$', KRW: '₩',
};

const CONTRIB_DAYS = {
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    quarterly: 91,
    halfyearly: 182,
    yearly: 365,
};

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
    const v = {
        currency: document.getElementById('currency').value,
        principal: parseFloat(document.getElementById('principal').value) || 0,
        rate: parseFloat(document.getElementById('rate').value) || 0,
        compoundFreq: parseInt(document.getElementById('compoundFreq').value, 10),
        years: parseInt(document.getElementById('years').value, 10) || 0,
        months: parseInt(document.getElementById('months').value, 10) || 0,
        contribAmount: parseFloat(document.getElementById('contribAmount').value) || 0,
        contribFreq: document.getElementById('contribFreq').value,
        increaseType: document.getElementById('increaseType').value,
        increaseValue: parseFloat(document.getElementById('increaseValue').value) || 0,
    };
    v.contribEnabled = v.contribAmount > 0;
    return v;
}

function calculate(v) {
    const totalDays = v.years * 365 + v.months * 30;
    if (totalDays <= 0) {
        return { final: v.principal, totalContrib: 0, totalInterest: 0, yearly: [] };
    }

    const r = v.rate / 100;
    const n = v.compoundFreq;
    const dailyGrowth = r > 0 ? Math.pow(1 + r / n, n / 365) : 1;

    let balance = v.principal;
    let totalContrib = 0;
    let totalInterest = 0;
    let currentContribAmount = v.contribAmount;
    const contribInterval = CONTRIB_DAYS[v.contribFreq] || 30;

    const yearly = [];
    let yearContrib = 0;
    let yearInterest = 0;

    for (let day = 1; day <= totalDays; day++) {
        const interestToday = balance * (dailyGrowth - 1);
        balance += interestToday;
        totalInterest += interestToday;
        yearInterest += interestToday;

        if (v.contribEnabled && currentContribAmount > 0 && day % contribInterval === 0) {
            balance += currentContribAmount;
            totalContrib += currentContribAmount;
            yearContrib += currentContribAmount;
        }

        if (day % 365 === 0) {
            const yearNum = day / 365;
            yearly.push({
                year: yearNum,
                contributions: yearContrib,
                interest: yearInterest,
                balance,
            });
            yearContrib = 0;
            yearInterest = 0;

            if (v.contribEnabled && v.increaseType !== 'none' && v.increaseValue > 0) {
                if (v.increaseType === 'amount') {
                    currentContribAmount += v.increaseValue;
                } else if (v.increaseType === 'percent') {
                    currentContribAmount *= 1 + v.increaseValue / 100;
                }
            }
        }
    }

    if (totalDays % 365 !== 0) {
        const partialYear = totalDays / 365;
        yearly.push({
            year: Math.ceil(partialYear),
            contributions: yearContrib,
            interest: yearInterest,
            balance,
            partial: true,
        });
    }

    return { final: balance, totalContrib, totalInterest, yearly };
}

function renderResult(v, result) {
    document.getElementById('resultEmpty').hidden = true;
    document.getElementById('resultContent').hidden = false;

    document.getElementById('finalBalance').textContent = fmt(v.currency, result.final);
    document.getElementById('totalContrib').textContent = fmt(v.currency, result.totalContrib + v.principal);
    document.getElementById('totalInterest').textContent = fmt(v.currency, result.totalInterest);

    const tbody = document.querySelector('#breakdownTable tbody');
    tbody.innerHTML = '';
    for (const row of result.yearly) {
        const tr = document.createElement('tr');
        const yLabel = row.partial ? `${row.year} (partial)` : `Year ${row.year}`;
        tr.innerHTML = `
            <td>${yLabel}</td>
            <td>${fmt(v.currency, row.contributions)}</td>
            <td>${fmt(v.currency, row.interest)}</td>
            <td>${fmt(v.currency, row.balance)}</td>
        `;
        tbody.appendChild(tr);
    }

    document.getElementById('saveBtn').disabled = false;
}

function buildSaveEntry(v, result) {
    const durLabel = `${v.years}y ${v.months}m`;
    const contribLabel = v.contribEnabled
        ? `, +${fmt(v.currency, v.contribAmount)}/${v.contribFreq}`
        : '';
    return {
        title: `${fmt(v.currency, v.principal)} @ ${v.rate}% · ${durLabel}`,
        source: 'compound-interest',
        expression: `principal ${fmt(v.currency, v.principal)}, ${v.rate}% (${v.compoundFreq}/yr), ${durLabel}${contribLabel}`,
        result: fmt(v.currency, result.final),
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
        placeholder: 'e.g. Retirement plan',
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

document.getElementById('increaseType').addEventListener('change', (e) => {
    const field = document.getElementById('increaseValueField');
    field.hidden = e.target.value === 'none';
});

document.getElementById('ci-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = getFormValues();
    const result = calculate(v);
    lastResult = { v, result };
    renderResult(v, result);
});

document.getElementById('ci-form').addEventListener('reset', () => {
    setTimeout(() => {
        document.getElementById('resultContent').hidden = true;
        document.getElementById('resultEmpty').hidden = false;
        document.getElementById('saveBtn').disabled = true;
        lastResult = null;
    }, 0);
});

document.getElementById('saveBtn').addEventListener('click', saveResult);

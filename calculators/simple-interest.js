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
    return {
        currency: document.getElementById('currency').value,
        principal: parseFloat(document.getElementById('principal').value) || 0,
        rate: parseFloat(document.getElementById('rate').value) || 0,
        ratePeriod: document.getElementById('ratePeriod').value,
        years: parseInt(document.getElementById('years').value, 10) || 0,
        months: parseInt(document.getElementById('months').value, 10) || 0,
        contribAmount: parseFloat(document.getElementById('contribAmount').value) || 0,
        contribFreq: document.getElementById('contribFreq').value,
        contribEnabled: (parseFloat(document.getElementById('contribAmount').value) || 0) > 0,
    };
}

function calculate(v) {
    const totalDays = v.years * 365 + v.months * 30;
    if (totalDays <= 0) {
        return { final: v.principal, totalDeposited: v.principal, totalInterest: 0, yearly: [] };
    }

    const annualRate = v.ratePeriod === 'monthly' ? (v.rate / 100) * 12 : v.rate / 100;
    const dailyRate = annualRate / 365;

    let totalInterest = v.principal * dailyRate * totalDays;
    let totalContrib = 0;

    const contribInterval = v.contribEnabled ? (CONTRIB_DAYS[v.contribFreq] || 30) : 0;

    const yearMarks = [];
    for (let y = 1; y <= v.years; y++) yearMarks.push(y * 365);
    if (totalDays > (yearMarks[yearMarks.length - 1] || 0)) yearMarks.push(totalDays);

    const principalInterestByDay = (uptoDay) => v.principal * dailyRate * Math.min(uptoDay, totalDays);

    const contribEvents = [];
    if (v.contribEnabled && v.contribAmount > 0 && contribInterval > 0) {
        for (let d = contribInterval; d <= totalDays; d += contribInterval) {
            contribEvents.push(d);
            totalContrib += v.contribAmount;
        }
    }
    for (const depositDay of contribEvents) {
        const remainingDays = totalDays - depositDay;
        totalInterest += v.contribAmount * dailyRate * remainingDays;
    }

    const yearly = [];
    let lastBalance = v.principal;
    let lastContribSum = 0;
    let lastInterestSum = 0;

    for (const markDay of yearMarks) {
        const contribUpTo = contribEvents.filter((d) => d <= markDay).length * v.contribAmount;
        let interestUpTo = principalInterestByDay(markDay);
        for (const depositDay of contribEvents) {
            if (depositDay <= markDay) {
                interestUpTo += v.contribAmount * dailyRate * (markDay - depositDay);
            }
        }
        const balance = v.principal + contribUpTo + interestUpTo;
        const partial = markDay !== Math.round(markDay / 365) * 365 || markDay > v.years * 365;
        yearly.push({
            year: Math.ceil(markDay / 365),
            contributions: contribUpTo - lastContribSum,
            interest: interestUpTo - lastInterestSum,
            balance,
            partial: markDay < (Math.ceil(markDay / 365) * 365),
        });
        lastBalance = balance;
        lastContribSum = contribUpTo;
        lastInterestSum = interestUpTo;
    }

    const final = v.principal + totalContrib + totalInterest;
    return {
        final,
        totalDeposited: v.principal + totalContrib,
        totalInterest,
        yearly,
    };
}

function renderResult(v, result) {
    document.getElementById('resultEmpty').hidden = true;
    document.getElementById('resultContent').hidden = false;

    document.getElementById('finalBalance').textContent = fmt(v.currency, result.final);
    document.getElementById('totalDeposited').textContent = fmt(v.currency, result.totalDeposited);
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
    const rateLabel = `${v.rate}%/${v.ratePeriod === 'monthly' ? 'mo' : 'yr'}`;
    const contribLabel = v.contribEnabled
        ? `, +${fmt(v.currency, v.contribAmount)}/${v.contribFreq}`
        : '';
    return {
        title: `${fmt(v.currency, v.principal)} @ ${rateLabel} · ${durLabel}`,
        source: 'simple-interest',
        expression: `principal ${fmt(v.currency, v.principal)}, ${rateLabel}, ${durLabel}${contribLabel}`,
        result: fmt(v.currency, result.final),
        inputs: v,
    };
}

function saveResult() {
    if (!lastResult) return;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const items = raw ? JSON.parse(raw) : [];
        const arr = Array.isArray(items) ? items : [];
        arr.unshift({
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            ...buildSaveEntry(lastResult.v, lastResult.result),
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

document.getElementById('si-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = getFormValues();
    const result = calculate(v);
    lastResult = { v, result };
    renderResult(v, result);
});

document.getElementById('si-form').addEventListener('reset', () => {
    setTimeout(() => {
        document.getElementById('resultContent').hidden = true;
        document.getElementById('resultEmpty').hidden = false;
        document.getElementById('saveBtn').disabled = true;
        lastResult = null;
    }, 0);
});

document.getElementById('saveBtn').addEventListener('click', saveResult);

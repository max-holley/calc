(function () {
    let activeResolver = null;
    let backdropEl = null;
    let inputEl = null;
    let titleEl = null;
    let labelEl = null;
    let okBtn = null;
    let cancelBtn = null;
    let previousFocus = null;

    function build() {
        if (backdropEl) return;
        backdropEl = document.createElement('div');
        backdropEl.className = 'modal-backdrop';
        backdropEl.setAttribute('role', 'presentation');
        backdropEl.hidden = true;
        backdropEl.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                <h2 id="modal-title" class="modal-title"></h2>
                <label class="modal-label" for="modal-input"></label>
                <input id="modal-input" type="text" class="modal-input" autocomplete="off">
                <div class="modal-actions">
                    <button type="button" class="btn-ghost" data-modal-cancel>Cancel</button>
                    <button type="button" class="btn-primary" data-modal-ok>Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(backdropEl);

        titleEl = backdropEl.querySelector('.modal-title');
        labelEl = backdropEl.querySelector('.modal-label');
        inputEl = backdropEl.querySelector('.modal-input');
        okBtn = backdropEl.querySelector('[data-modal-ok]');
        cancelBtn = backdropEl.querySelector('[data-modal-cancel]');

        okBtn.addEventListener('click', () => close(inputEl.value));
        cancelBtn.addEventListener('click', () => close(null));
        backdropEl.addEventListener('click', (e) => {
            if (e.target === backdropEl) close(null);
        });
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); close(inputEl.value); }
        });
        document.addEventListener('keydown', (e) => {
            if (!backdropEl.hidden && e.key === 'Escape') close(null);
        });
    }

    function close(value) {
        if (!activeResolver) return;
        const resolve = activeResolver;
        activeResolver = null;
        backdropEl.hidden = true;
        document.body.classList.remove('modal-open');
        if (previousFocus && typeof previousFocus.focus === 'function') {
            previousFocus.focus();
        }
        resolve(value);
    }

    let detailEl = null;

    function buildDetail() {
        if (detailEl) return;
        detailEl = document.createElement('div');
        detailEl.className = 'modal-backdrop';
        detailEl.hidden = true;
        detailEl.innerHTML = `
            <div class="modal modal-detail" role="dialog" aria-modal="true">
                <div class="modal-detail-head">
                    <div>
                        <h2 class="modal-title" data-detail-title></h2>
                        <div class="modal-detail-meta">
                            <span class="saved-source" data-detail-source></span>
                            <span class="modal-detail-date" data-detail-date></span>
                        </div>
                    </div>
                    <button type="button" class="modal-close" data-detail-close aria-label="Close dialog">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="modal-detail-result">
                    <span class="summary-label">Result</span>
                    <span class="summary-value accent" data-detail-result></span>
                </div>
                <div class="modal-detail-body">
                    <h3 class="modal-detail-section">Inputs</h3>
                    <dl class="kv-list" data-detail-inputs></dl>
                </div>
                <div class="modal-actions modal-detail-actions">
                    <button type="button" class="btn-modal-close" data-detail-close-bottom>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>Done</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(detailEl);

        const closeFn = () => {
            detailEl.hidden = true;
            document.body.classList.remove('modal-open');
        };
        detailEl.querySelector('[data-detail-close]').addEventListener('click', closeFn);
        detailEl.querySelector('[data-detail-close-bottom]').addEventListener('click', closeFn);
        detailEl.addEventListener('click', (e) => {
            if (e.target === detailEl) closeFn();
        });
        document.addEventListener('keydown', (e) => {
            if (!detailEl.hidden && e.key === 'Escape') closeFn();
        });
    }

    const INPUT_LABELS = {
        currency: 'Currency',
        principal: 'Starting Deposit',
        amount: 'Loan Amount',
        price: 'Vehicle Price',
        deposit: 'Deposit',
        rate: 'Interest Rate',
        ratePeriod: 'Rate Period',
        compoundFreq: 'Compound Frequency',
        years: 'Years',
        months: 'Months',
        paymentFreq: 'Payment Frequency',
        contribAmount: 'Contribution Amount',
        contribFreq: 'Contribution Frequency',
        contribEnabled: 'Contributions Enabled',
        increaseType: 'Annual Increase Type',
        increaseValue: 'Annual Increase Value',
        balloon: 'Balloon Payment',
        docFee: 'Documentation Fee',
        optionFee: 'Option-to-Purchase Fee',
        originationFee: 'Origination Fee',
        feeHandling: 'Fee Handling',
    };

    const COMPOUND_FREQ_LABELS = {
        1: 'Annually', 2: 'Semi-annually', 4: 'Quarterly',
        12: 'Monthly', 26: 'Bi-weekly', 52: 'Weekly', 365: 'Daily',
    };

    function prettyKey(key) {
        if (INPUT_LABELS[key]) return INPUT_LABELS[key];
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    }

    function prettyValue(key, val, currency) {
        if (val === '' || val === null || val === undefined) return '—';
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        if (key === 'compoundFreq') return COMPOUND_FREQ_LABELS[val] || String(val);
        if (key === 'rate' || key === 'increaseValue') {
            if (key === 'increaseValue' && val === 0) return '—';
            return `${val}${key === 'increaseValue' ? '' : '%'}`;
        }
        if (key === 'ratePeriod') return val === 'monthly' ? 'Per month' : 'Per year';
        if (key === 'paymentFreq' || key === 'contribFreq') {
            const map = {
                weekly: 'Weekly', biweekly: 'Bi-weekly', monthly: 'Monthly',
                quarterly: 'Quarterly', halfyearly: 'Half-yearly', yearly: 'Yearly',
            };
            return map[val] || val;
        }
        if (key === 'increaseType') {
            return { none: 'None', amount: 'Fixed amount', percent: 'Percentage' }[val] || val;
        }
        if (key === 'feeHandling') {
            return val === 'financed' ? 'Added to loan' : 'Paid upfront';
        }
        const moneyKeys = ['principal', 'amount', 'price', 'deposit', 'contribAmount', 'balloon', 'docFee', 'optionFee', 'originationFee'];
        if (moneyKeys.includes(key) && typeof val === 'number') {
            try {
                return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(val);
            } catch {
                return val.toLocaleString();
            }
        }
        return String(val);
    }

    window.detailModal = function (item) {
        buildDetail();
        detailEl.querySelector('[data-detail-title]').textContent = item.title || 'Untitled';
        detailEl.querySelector('[data-detail-source]').textContent = item.source || 'calc';
        const dateEl = detailEl.querySelector('[data-detail-date]');
        dateEl.textContent = item.createdAt
            ? new Date(item.createdAt).toLocaleString()
            : '';
        detailEl.querySelector('[data-detail-result]').textContent = item.result || '—';

        const dl = detailEl.querySelector('[data-detail-inputs]');
        dl.innerHTML = '';
        const inputs = item.inputs || {};
        const currency = inputs.currency;
        const ordered = Object.keys(inputs).filter((k) => k !== 'contribEnabled');
        if (ordered.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = 'No input details stored for this entry.';
            dl.replaceWith(empty);
        } else {
            for (const k of ordered) {
                const dt = document.createElement('dt');
                dt.textContent = prettyKey(k);
                const dd = document.createElement('dd');
                dd.textContent = prettyValue(k, inputs[k], currency);
                dl.appendChild(dt);
                dl.appendChild(dd);
            }
        }

        if (item.expression) {
            const existing = detailEl.querySelector('.modal-detail-expression');
            if (existing) existing.remove();
            const note = document.createElement('p');
            note.className = 'modal-detail-expression';
            note.textContent = item.expression;
            detailEl.querySelector('.modal-detail-body').appendChild(note);
        }

        detailEl.hidden = false;
        document.body.classList.add('modal-open');
    };

    window.promptModal = function (options = {}) {
        build();
        const {
            title = 'Enter value',
            label = '',
            defaultValue = '',
            placeholder = '',
            okText = 'Save',
            cancelText = 'Cancel',
        } = options;

        titleEl.textContent = title;
        labelEl.textContent = label;
        labelEl.hidden = !label;
        inputEl.value = defaultValue;
        inputEl.placeholder = placeholder;
        okBtn.textContent = okText;
        cancelBtn.textContent = cancelText;

        previousFocus = document.activeElement;
        backdropEl.hidden = false;
        document.body.classList.add('modal-open');

        return new Promise((resolve) => {
            activeResolver = resolve;
            setTimeout(() => {
                inputEl.focus();
                inputEl.select();
            }, 0);
        });
    };
})();

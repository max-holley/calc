const STORAGE_KEY = 'calc.saved';

const calculators = [
    {
        id: 'compound-interest',
        name: 'Compound Interest',
        desc: 'Project growth of a deposit with optional recurring contributions.',
        href: 'calculators/compound-interest.html',
    },
    {
        id: 'simple-interest',
        name: 'Simple Interest',
        desc: 'Flat interest on principal plus optional recurring contributions.',
        href: 'calculators/simple-interest.html',
    },
    {
        id: 'car-loan',
        name: 'Car Loan (Hire Purchase)',
        desc: 'Work out monthly payments and total cost of a hire purchase vehicle.',
        href: 'calculators/car-loan.html',
    },
    {
        id: 'personal-loan',
        name: 'Personal Loan',
        desc: 'Repayments and total interest for a personal loan.',
        href: 'calculators/personal-loan.html',
    },
];

function getSaved() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function setSaved(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

let currentQuery = '';

function renderCalculators() {
    const list = document.getElementById('calc-list');
    const empty = document.getElementById('calc-empty');
    const noMatch = document.getElementById('calc-no-match');
    const count = document.getElementById('calc-count');

    list.innerHTML = '';

    const q = currentQuery.trim().toLowerCase();
    const filtered = q
        ? calculators.filter((c) =>
            c.name.toLowerCase().includes(q) || (c.desc || '').toLowerCase().includes(q))
        : calculators;

    count.textContent = q
        ? `${filtered.length} of ${calculators.length}`
        : `${calculators.length} available`;

    empty.hidden = calculators.length !== 0;
    noMatch.hidden = !(calculators.length > 0 && filtered.length === 0);

    if (filtered.length === 0) return;

    for (const c of filtered) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'calc-item';
        a.href = c.href;

        const left = document.createElement('div');
        const name = document.createElement('span');
        name.className = 'calc-name';
        name.textContent = c.name;
        const desc = document.createElement('span');
        desc.className = 'calc-desc';
        desc.textContent = c.desc;
        left.appendChild(name);
        left.appendChild(desc);

        const arrow = document.createElement('span');
        arrow.className = 'calc-arrow';
        arrow.textContent = '→';

        a.appendChild(left);
        a.appendChild(arrow);
        li.appendChild(a);
        list.appendChild(li);
    }
}

function renderSaved() {
    const list = document.getElementById('saved-list');
    const empty = document.getElementById('saved-empty');
    const items = getSaved();

    list.innerHTML = '';

    if (items.length === 0) {
        empty.hidden = false;
        return;
    }
    empty.hidden = true;

    items.forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = 'saved-item';
        li.tabIndex = 0;
        li.setAttribute('role', 'button');
        li.setAttribute('aria-label', `View details for ${item.title || 'saved calculation'}`);

        const head = document.createElement('div');
        head.className = 'saved-head';
        const title = document.createElement('span');
        title.className = 'saved-title';
        title.textContent = item.title || 'Untitled';
        const source = document.createElement('span');
        source.className = 'saved-source';
        source.textContent = item.source || 'calc';
        head.appendChild(title);
        head.appendChild(source);

        const expr = document.createElement('div');
        expr.className = 'saved-expr';
        expr.textContent = item.expression
            ? `${item.expression} = ${item.result ?? ''}`
            : (item.result ?? '');

        const actions = document.createElement('div');
        actions.className = 'saved-actions';
        const del = document.createElement('button');
        del.className = 'btn-mini danger';
        del.type = 'button';
        del.textContent = 'Delete';
        del.addEventListener('click', (e) => {
            e.stopPropagation();
            const current = getSaved();
            current.splice(idx, 1);
            setSaved(current);
            renderSaved();
        });
        actions.appendChild(del);

        li.appendChild(head);
        li.appendChild(expr);
        li.appendChild(actions);

        li.addEventListener('click', () => {
            if (window.detailModal) window.detailModal(item);
        });
        li.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (window.detailModal) window.detailModal(item);
            }
        });

        list.appendChild(li);
    });
}

document.getElementById('clear-saved').addEventListener('click', () => {
    if (getSaved().length === 0) return;
    if (confirm('Delete all saved calculations? This cannot be undone.')) {
        setSaved([]);
        renderSaved();
    }
});

window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) renderSaved();
});

window.calcStore = {
    save(entry) {
        const items = getSaved();
        items.unshift({
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            ...entry,
        });
        setSaved(items);
    },
    list: getSaved,
    clear() { setSaved([]); },
};

const searchInput = document.getElementById('calc-search');
searchInput.addEventListener('input', (e) => {
    currentQuery = e.target.value;
    renderCalculators();
});

renderCalculators();
renderSaved();

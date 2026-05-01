let cache = {};
let myCoins = [];
const listDiv = document.getElementById('coinList');

chrome.storage.local.get(['coins'], (result) => {
    myCoins = result.coins || ['BTCUSDT.P', 'ETHUSDT.P'];
    renderList();
    update();
});

function renderList() {
    listDiv.innerHTML = '';
    myCoins.forEach((sym, index) => {
        const safeId = sym.replace('.', '_');
        const row = document.createElement('div');
        row.className = 'row';
        row.draggable = true;
        row.dataset.index = index;
        row.innerHTML = `
            <div class="coin-info">
                <span class="sym">${sym}</span>
                <span id="${safeId}" class="val">...</span>
            </div>
            <span class="del-btn" data-sym="${sym}">SİL</span>
        `;
        row.addEventListener('dragstart', handleDragStart);
        row.addEventListener('dragover', handleDragOver);
        row.addEventListener('drop', handleDrop);
        row.addEventListener('dragend', handleDragEnd);
        listDiv.appendChild(row);
    });
}

let dragSrcEl = null;
function handleDragStart(e) {
    dragSrcEl = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.index);
}
function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    return false;
}
function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    const targetIndex = this.dataset.index;
    const sourceIndex = e.dataTransfer.getData('text/plain');
    if (sourceIndex !== targetIndex) {
        const movedItem = myCoins.splice(sourceIndex, 1)[0];
        myCoins.splice(targetIndex, 0, movedItem);
        chrome.storage.local.set({ coins: myCoins }, () => {
            renderList();
            update();
        });
    }
    return false;
}
function handleDragEnd() { this.classList.remove('dragging'); }

document.getElementById('addBtn').onclick = () => {
    const input = document.getElementById('coinInput');
    const newSym = input.value.toUpperCase().trim();
    if (newSym && !myCoins.includes(newSym)) {
        myCoins.push(newSym);
        chrome.storage.local.set({ coins: myCoins }, () => {
            renderList();
            update();
            input.value = '';
        });
    }
};

listDiv.onclick = (e) => {
    if (e.target.classList.contains('del-btn')) {
        const symToDelete = e.target.getAttribute('data-sym');
        myCoins = myCoins.filter(c => c !== symToDelete);
        chrome.storage.local.set({ coins: myCoins }, renderList);
    }
};

async function update() {
    if (myCoins.length === 0) {
        document.getElementById('status').innerText = "Liste boş.";
        return;
    }
    try {
        const [spotRes, futuresRes] = await Promise.all([
            fetch('https://api.binance.com/api/v3/ticker/price'),
            fetch('https://fapi.binance.com/fapi/v1/ticker/price')
        ]);
        const spotData = await spotRes.json();
        const futuresData = await futuresRes.json();
        myCoins.forEach(sym => {
            let coinData;
            if (sym.endsWith('.P')) {
                const pureSym = sym.replace('.P', '');
                coinData = futuresData.find(item => item.symbol === pureSym);
            } else {
                coinData = spotData.find(item => item.symbol === sym);
            }
            const el = document.getElementById(sym.replace('.', '_'));
            if (coinData && el) {
                const price = parseFloat(coinData.price);
                if (cache[sym]) el.className = price >= cache[sym] ? "val up" : "val down";
                cache[sym] = price;
                el.innerText = price.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
            }
        });
        document.getElementById('status').innerText = "GÜNCEL: " + new Date().toLocaleTimeString();
    } catch (e) {
        document.getElementById('status').innerText = "Hata!";
    }
}

setInterval(update, 250);
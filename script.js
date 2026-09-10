/* ===== Navegação entre telas ===== */
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

/* ===================================================== */
/* ===== ENCURTADOR ===== */
/* ===================================================== */
const DB_URL = "https://meu-encurtador-e5878-default-rtdb.firebaseio.com";
const currentDomain = window.location.origin + window.location.pathname;
document.getElementById('domainPrefix').textContent = window.location.hostname + '/?l=';

let localUserId = localStorage.getItem('nexus_user_id');
if (!localUserId) {
    localUserId = 'user_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('nexus_user_id', localUserId);
}

const urlParams = new URLSearchParams(window.location.search);
const aliasParam = urlParams.get('l');

if (aliasParam) {
    document.getElementById('mainContainer').style.display = 'none';
    document.getElementById('redirectScreen').style.display = 'block';

    fetch(`${DB_URL}/links/${aliasParam.toLowerCase()}.json`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (data && data.originalUrl && !data.blocked) {
                const clicks = (data.clicks || 0) + 1;
                fetch(`${DB_URL}/links/${aliasParam.toLowerCase()}/clicks.json`, {
                    method: 'PUT',
                    body: JSON.stringify(clicks)
                });
                window.location.href = data.originalUrl;
            } else if (data && data.blocked) {
                document.querySelector('#screen-encurtador .spinner').style.display = 'none';
                document.getElementById('redirectMsg').textContent = 'Este link foi suspenso por violar os termos de uso.';
            } else {
                document.querySelector('#screen-encurtador .spinner').style.display = 'none';
                document.getElementById('redirectMsg').textContent = 'Link não encontrado!';
            }
        })
        .catch(() => {
            document.querySelector('#screen-encurtador .spinner').style.display = 'none';
            document.getElementById('redirectMsg').textContent = 'Erro de conexão com o servidor.';
        });
}

document.getElementById('shortenForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const btnSubmit = document.getElementById('btnSubmit');
    const longUrl = document.getElementById('longUrl').value.trim();
    let customAlias = document.getElementById('customAlias').value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    const errorMsg = document.getElementById('errorMsg');

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Encurtando...';
    errorMsg.style.display = 'none';

    if (!customAlias) {
        customAlias = Math.random().toString(36).substring(2, 8);
    }

    try {
        const checkRes = await fetch(`${DB_URL}/links/${customAlias}.json`);
        if (checkRes.ok) {
            const existing = await checkRes.json();
            if (existing && existing.originalUrl) {
                errorMsg.style.display = 'block';
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Encurtar Link';
                return;
            }
        }

        const finalShortUrl = currentDomain + '?l=' + customAlias;

        const saveRes = await fetch(`${DB_URL}/links/${customAlias}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                originalUrl: longUrl,
                createdAt: Date.now(),
                userId: localUserId,
                clicks: 0,
                blocked: false
            })
        });

        if (!saveRes.ok) {
            alert('Erro ao salvar o link.');
            return;
        }

        saveToLocalHistory(customAlias, longUrl);

        const shortDisplay = document.getElementById('shortUrlDisplay');
        shortDisplay.textContent = finalShortUrl;
        shortDisplay.href = finalShortUrl;
        document.getElementById('resultArea').style.display = 'block';

        document.getElementById('longUrl').value = '';
        document.getElementById('customAlias').value = '';
        loadLocalHistory();

    } catch (err) {
        alert('Erro de conexão ao tentar salvar o link.');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Encurtar Link';
    }
});

function copyLink() {
    const shortUrl = document.getElementById('shortUrlDisplay').textContent;
    navigator.clipboard.writeText(shortUrl).then(() => {
        const copyBtn = document.getElementById('copyBtn');
        copyBtn.textContent = 'Copiado!';
        setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 2000);
    });
}

function saveToLocalHistory(alias, originalUrl) {
    let userLinks = JSON.parse(localStorage.getItem('nexus_my_links') || '[]');
    userLinks.unshift({ alias, originalUrl });
    userLinks = userLinks.slice(0, 5);
    localStorage.setItem('nexus_my_links', JSON.stringify(userLinks));
}

function loadLocalHistory() {
    const historyList = document.getElementById('historyList');
    const userLinks = JSON.parse(localStorage.getItem('nexus_my_links') || '[]');

    if (userLinks.length === 0) {
        historyList.innerHTML = '<p class="history-empty">Nenhum link criado ainda por você neste navegador.</p>';
        return;
    }

    historyList.innerHTML = '';
    userLinks.forEach(item => {
        const fullShort = currentDomain + '?l=' + item.alias;
        const li = document.createElement('li');
        li.className = 'history-item';
        li.innerHTML = `
            <div class="history-details">
                <a href="${fullShort}" target="_blank" class="history-short">${fullShort}</a>
                <span class="history-long">${item.originalUrl}</span>
            </div>
            <button class="btn-copy" style="border-color: var(--border); color: var(--text-muted);" onclick="navigator.clipboard.writeText('${fullShort}')">Copiar</button>
        `;
        historyList.appendChild(li);
    });
}

loadLocalHistory();

/* ===================================================== */
/* ===== DROPZONE CLOUD ===== */
/* ===================================================== */
const IMGBB_API_KEY = "8980b893a10690c3abe72da7806bc5af";

const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressStatus = document.getElementById('progressStatus');
const galleryGrid = document.getElementById('galleryGrid');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
});

dropArea.addEventListener('dragenter', () => dropArea.classList.add('drag-over'));
dropArea.addEventListener('dragover', () => dropArea.classList.add('drag-over'));
dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
dropArea.addEventListener('drop', (e) => {
    dropArea.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

function handleFiles(files) {
    if (!files.length) return;
    Array.from(files).forEach(file => uploadImage(file));
}

function uploadImage(file) {
    progressContainer.style.display = 'block';
    progressFill.style.width = '40%';
    progressStatus.innerText = `Enviando "${file.name}"...`;

    const formData = new FormData();
    formData.append('image', file);

    fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                progressFill.style.width = '100%';
                progressStatus.innerText = 'Upload concluído!';

                const d = data.data;
                const directUrl = d.url;
                const viewerUrl = d.url_viewer;
                const bbcode = `[img]${d.url}[/img]`;
                const htmlCode = `<img src="${d.url}" alt="${file.name}" />`;

                createImageCard(file.name, d.display_url || d.url, directUrl, viewerUrl, bbcode, htmlCode);

                setTimeout(() => {
                    progressContainer.style.display = 'none';
                    progressFill.style.width = '0%';
                }, 1200);
            } else {
                alert('Ocorreu um erro no upload da imagem. Verifique a API key do ImgBB.');
                console.error('Resposta da API ImgBB:', data);
                progressContainer.style.display = 'none';
            }
        })
        .catch(err => {
            console.error(err);
            alert('Erro ao conectar com o servidor.');
            progressContainer.style.display = 'none';
        });
}

function createImageCard(fileName, previewUrl, directUrl, viewerUrl, bbcode, htmlCode) {
    const card = document.createElement('div');
    card.className = 'item-card';

    const safeHtml = htmlCode.replace(/"/g, '&quot;');

    card.innerHTML = `
        <div class="preview-box">
            <img src="${previewUrl}" alt="${fileName}">
        </div>
        <div class="item-details">
            <div class="item-name" title="${fileName}">${fileName}</div>

            <div class="link-group">
                <span class="link-label">Link Direto (Imagem):</span>
                <div class="input-copy-wrapper">
                    <input type="text" value="${directUrl}" readonly onclick="this.select()">
                    <button type="button" class="btn-copy" onclick="copyText(event, '${directUrl}')">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            </div>

            <div class="link-group">
                <span class="link-label">Página da Imagem:</span>
                <div class="input-copy-wrapper">
                    <input type="text" value="${viewerUrl}" readonly onclick="this.select()">
                    <button type="button" class="btn-copy" onclick="copyText(event, '${viewerUrl}')">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            </div>

            <div class="link-group">
                <span class="link-label">Código HTML:</span>
                <div class="input-copy-wrapper">
                    <input type="text" value="${safeHtml}" readonly onclick="this.select()">
                    <button type="button" class="btn-copy" onclick="copyText(event, '${safeHtml}')">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            </div>

            <div class="link-group">
                <span class="link-label">BBCode (Fóruns):</span>
                <div class="input-copy-wrapper">
                    <input type="text" value="${bbcode}" readonly onclick="this.select()">
                    <button type="button" class="btn-copy" onclick="copyText(event, '${bbcode}')">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            </div>

        </div>
    `;

    galleryGrid.prepend(card);
}

function copyText(e, text) {
    if (e) e.preventDefault();

    const btn = e ? e.currentTarget : null;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => showToast(btn));
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast(btn);
    }
}

function showToast(btn) {
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = 'fa-solid fa-check';
            btn.style.color = '#10b981';
            setTimeout(() => {
                icon.className = 'fa-solid fa-copy';
                btn.style.color = '';
            }, 1500);
        }
    }
}

const CAMINHO_DADOS = './services.json';

const estado = {
    servicos: [],
    pistasUnicas: [],
    selecionadas: new Set(),
};

const els = {
    tagCloud: document.getElementById('tag-cloud'),
    filtroPistas: document.getElementById('filtro-pistas'),
    btnInvestigar: document.getElementById('btn-investigar'),
    btnLimpar: document.getElementById('btn-limpar'),
    contador: document.getElementById('contador'),
    resultados: document.getElementById('resultados'),
};

async function init() {
    try {
        const resposta = await fetch(CAMINHO_DADOS);
        if (!resposta.ok) throw new Error(`Falha ao carregar dados (status ${resposta.status})`);
        estado.servicos = await resposta.json();
        estado.pistasUnicas = extrairPistasUnicas(estado.servicos);
        renderizarTagCloud(estado.pistasUnicas);
        ligarEventos();
    } catch (erro) {
        console.error('Cloud Sherlock: erro ao carregar services.json', erro);
        mostrarMensagem(els.tagCloud, 'Não foi possível carregar as pistas agora. Tente novamente mais tarde.');
    }
}

function extrairPistasUnicas(servicos) {
    const conjunto = new Set();
    servicos.forEach(s => s.tags.forEach(t => conjunto.add(t)));
    return [...conjunto].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }

function renderizarTagCloud(pistas) {
    els.tagCloud.innerHTML = '';
    pistas.forEach(pista => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'tag-chip';
        chip.textContent = pista; // textContent: seguro contra injeção de HTML
        chip.dataset.pista = pista;
        chip.setAttribute('aria-pressed', 'false');
        chip.addEventListener('click', () => alternarPista(chip, pista));
        els.tagCloud.appendChild(chip);
    });
}

function alternarPista(chip, pista) {
    if (estado.selecionadas.has(pista)) {
        estado.selecionadas.delete(pista);
        chip.classList.remove('selecionada');
        chip.setAttribute('aria-pressed', 'false');
    } else {
        estado.selecionadas.add(pista);
        chip.classList.add('selecionada');
        chip.setAttribute('aria-pressed', 'true');
    }
    atualizarContador();
}

function atualizarContador() {
    const n = estado.selecionadas.size;
    els.contador.textContent = n > 0 ? `${n} pista${n > 1 ? 's' : ''} selecionada${n > 1 ? 's' : ''}` : '';
}

function ligarEventos() {
    els.btnInvestigar.addEventListener('click', investigar);
    els.btnLimpar.addEventListener('click', limparTudo);
    els.filtroPistas.addEventListener('input', filtrarPistasVisiveis);
}

function filtrarPistasVisiveis() {
    const termo = els.filtroPistas.value.trim().toLowerCase();
    const chips = els.tagCloud.querySelectorAll('.tag-chip');
    chips.forEach(chip => {
        const visivel = chip.dataset.pista.toLowerCase().includes(termo);
        chip.classList.toggle('escondida', !visivel);
    });
}

function limparTudo() {
    estado.selecionadas.clear();
    els.tagCloud.querySelectorAll('.tag-chip').forEach(chip => {
        chip.classList.remove('selecionada');
        chip.setAttribute('aria-pressed', 'false');
    });
    els.filtroPistas.value = '';
    filtrarPistasVisiveis();
    atualizarContador();
    els.resultados.innerHTML = '';
}

function investigar() {
    if (estado.selecionadas.size === 0) {
        mostrarMensagem(els.resultados, 'Selecione ao menos uma pista para investigar.');
        return;
    }

    const ranking = estado.servicos
    .map(servico => {
        const pistasEncontradas = servico.tags.filter(t => estado.selecionadas.has(t));
        return { servico, score: pistasEncontradas.length };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);

    if (ranking.length === 0) {
        mostrarMensagem(els.resultados, 'Nenhum serviço combina com essas pistas. Tente remover alguma.');
        return;
    } 

    renderizarResultados(ranking, estado.selecionadas.size);
}

function renderizarResultados(ranking, totalSelecionadas) {
    els.resultados.innerHTML = '';
    ranking.forEach(({ servico, score }) => {
        const pct = Math.round((score / totalSelecionadas) * 100);
        els.resultados.appendChild(criarCardResultado(servico, pct));
    });
}

function criarCardResultado(servico, pct) {
    const card = document.createElement('article');
    card.className = 'card-resultado';

    const topo = document.createElement('div');
    topo.className = 'card-topo';

    const nome = document.createElement('h3');
    nome.className = 'card-nome';
    nome.textContent = servico.nome;

    const match = document.createElement('span');
    match.className = 'card-match';
    match.textContent = `${pct}% match`;

    topo.append(nome, match);

    const categoria = document.createElement('p');
    categoria.className = 'card-categoria';
    categoria.textContent = servico.categoria;

    const explicacao = document.createElement('p');
    explicacao.className = 'card-explicacao';
    explicacao.textContent = servico.explicacao;

    const caso = document.createElement('p');
    caso.className = 'card-caso';
    caso.textContent = `${servico.casoDeUso}`;

    card.append(topo, categoria, explicacao, caso);
    return card;
}

function mostrarMensagem(container, texto) {
    container.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'mensagem-vazia';
    p.textContent = texto;
    container.appendChild(p);
}

init();

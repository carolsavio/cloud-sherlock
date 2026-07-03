const CAMINHO_DADOS = './services.json';

const estado = {
  servicos: [],
  pistasUnicas: [],
  selecionadas: new Set(),
  modo: 'pistas', // 'pistas' | 'texto'
};

const els = {
  tagCloud: document.getElementById('tag-cloud'),
  filtroPistas: document.getElementById('filtro-pistas'),
  btnInvestigar: document.getElementById('btn-investigar'),
  btnLimpar: document.getElementById('btn-limpar'),
  contador: document.getElementById('contador'),
  resultados: document.getElementById('resultados'),
  tabPistas: document.getElementById('tab-pistas'),
  tabTexto: document.getElementById('tab-texto'),
  painelPistas: document.getElementById('modo-pistas-painel'),
  painelTexto: document.getElementById('modo-texto-painel'),
  inputTextoLivre: document.getElementById('input-texto-livre'),
  sugestaoTexto: document.getElementById('sugestao-texto'),
};

async function init() {
  try {
    const resposta = await fetch(CAMINHO_DADOS);
    if (!resposta.ok) throw new Error(`Falha ao carregar dados (status ${resposta.status})`);
    estado.servicos = await resposta.json();
    estado.gruposPistas = extrairPistasPorCategoria(estado.servicos);
    estado.pistasUnicas = [...new Set(estado.gruposPistas.flatMap(g => g.tags))];
    renderizarTagCloud(estado.gruposPistas);
    ligarEventos();
  } catch (erro) {
    console.error('Cloud Sherlock: erro ao carregar services.json', erro);
    mostrarMensagem(els.tagCloud, 'Não foi possível carregar as pistas agora. Tente novamente mais tarde.');
  }
}

function extrairPistasPorCategoria(servicos) {
  const mapa = new Map(); // categoria -> Set de tags
  servicos.forEach(servico => {
    if (!mapa.has(servico.categoria)) mapa.set(servico.categoria, new Set());
    servico.tags.forEach(tag => mapa.get(servico.categoria).add(tag));
  });
  // ordena categorias alfabeticamente, e as tags dentro de cada uma também
  return [...mapa.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([categoria, tagsSet]) => ({
      categoria,
      tags: [...tagsSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    }));
}

function renderizarTagCloud(grupos) {
  els.tagCloud.innerHTML = '';
  grupos.forEach(({ categoria, tags }) => {
    const grupo = document.createElement('div');
    grupo.className = 'grupo-pistas';

    const titulo = document.createElement('h3');
    titulo.className = 'grupo-titulo';
    titulo.textContent = categoria;

    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'grupo-chips';

    tags.forEach(pista => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tag-chip';
      chip.textContent = pista; // textContent: seguro contra injeção de HTML
      chip.dataset.pista = pista;
      chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', () => alternarPista(pista));
      chipsContainer.appendChild(chip);
    });

    grupo.append(titulo, chipsContainer);
    els.tagCloud.appendChild(grupo);
  });
}

function alternarPista(pista) {
  const vaiSelecionar = !estado.selecionadas.has(pista);
  if (vaiSelecionar) {
    estado.selecionadas.add(pista);
  } else {
    estado.selecionadas.delete(pista);
  }
  // a mesma pista pode aparecer em mais de um grupo (categoria)
  // sincroniza o estado visual de todas as ocorrências.
  els.tagCloud.querySelectorAll('.tag-chip').forEach(chip => {
    if (chip.dataset.pista === pista) {
      chip.classList.toggle('selecionada', vaiSelecionar);
      chip.setAttribute('aria-pressed', String(vaiSelecionar));
    }
  });
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
  els.tabPistas.addEventListener('click', () => alternarModo('pistas'));
  els.tabTexto.addEventListener('click', () => alternarModo('texto'));
  els.inputTextoLivre.addEventListener('keydown', e => {
    if (e.key === 'Enter') investigar();
  });
}

function alternarModo(modo) {
  estado.modo = modo;
  const ehPistas = modo === 'pistas';

  els.tabPistas.classList.toggle('ativo', ehPistas);
  els.tabPistas.setAttribute('aria-selected', String(ehPistas));
  els.tabTexto.classList.toggle('ativo', !ehPistas);
  els.tabTexto.setAttribute('aria-selected', String(!ehPistas));

  els.painelPistas.classList.toggle('escondido', !ehPistas);
  els.painelTexto.classList.toggle('escondido', ehPistas);

  els.resultados.innerHTML = '';
  els.sugestaoTexto.textContent = '';
}

function filtrarPistasVisiveis() {
  const termo = els.filtroPistas.value.trim().toLowerCase();
  els.tagCloud.querySelectorAll('.grupo-pistas').forEach(grupo => {
    let algumaVisivel = false;
    grupo.querySelectorAll('.tag-chip').forEach(chip => {
      const visivel = chip.dataset.pista.toLowerCase().includes(termo);
      chip.classList.toggle('escondido', !visivel);
      if (visivel) algumaVisivel = true;
    });
    grupo.classList.toggle('escondido', !algumaVisivel);
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
  if (estado.modo === 'pistas') {
    investigarPorPistas();
  } else {
    investigarPorTexto();
  }
}

function investigarPorPistas() {
  if (estado.selecionadas.size === 0) {
    mostrarMensagem(els.resultados, 'Selecione ao menos uma pista para investigar.');
    return;
  }

  const totalPistas = estado.selecionadas.size;

  const pontuados = estado.servicos
    .map(servico => {
      const score = servico.tags.filter(t => estado.selecionadas.has(t)).length;
      return { servico, score };
    })
    .filter(r => r.score > 0);

  if (pontuados.length === 0) {
    mostrarMensagem(els.resultados, 'Nenhum serviço combina com essas pistas. Tente remover alguma.');
    return;
  }

  // Match completo = o serviço tem TODAS as pistas selecionadas, não só algumas.
  const completos = pontuados
    .filter(r => r.score === totalPistas)
    .sort((a, b) => a.servico.nome.localeCompare(b.servico.nome, 'pt-BR'));

  const parciais = pontuados
    .filter(r => r.score < totalPistas)
    .sort((a, b) => b.score - a.score);

  els.resultados.innerHTML = '';

  if (completos.length > 0) {
    // Se só um serviço bate tudo, ele leva 100%. Se vários batem tudo,
    // a certeza se divide entre eles,é ambiguidade real, não parcialidade.
    const pctCadaCompleto = Math.round(100 / completos.length);
    completos.forEach(({ servico }) => {
      els.resultados.appendChild(criarCardResultado(servico, pctCadaCompleto));
    });

    if (parciais.length > 0) {
      els.resultados.appendChild(criarSecaoTitulo('Outras possibilidades'));
      parciais.forEach(({ servico, score }) => {
        const pct = Math.round((score / totalPistas) * 100);
        els.resultados.appendChild(criarCardResultado(servico, pct));
      });
    }
  } else {
    els.resultados.appendChild(
      criarParagrafo('Nenhum serviço combina com todas as pistas. Aqui estão os mais próximos:', 'mensagem-vazia')
    );
    parciais.forEach(({ servico, score }) => {
      const pct = Math.round((score / totalPistas) * 100);
      els.resultados.appendChild(criarCardResultado(servico, pct));
    });
  }
}

function criarSecaoTitulo(texto) {
  const h = document.createElement('h3');
  h.className = 'secao-titulo';
  h.textContent = texto;
  return h;
}

function criarParagrafo(texto, className) {
  const p = document.createElement('p');
  if (className) p.className = className;
  p.textContent = texto;
  return p;
}

// Cada serviço vira uma lista de termos pesquisáveis (tags têm peso maior
// que nome/categoria, já que carregam a intenção do usuário mais diretamente).
function termosPesquisaveis(servico) {
  return [
    ...servico.tags.map(t => ({ termo: normalizarTexto(t), peso: 3 })),
    { termo: normalizarTexto(servico.nome), peso: 2 },
    { termo: normalizarTexto(servico.categoria), peso: 1 },
  ];
}

// Tenta casar um token digitado contra um termo do serviço.
// Compara tanto contra a frase inteira quanto palavra por palavra
function pontuarToken(tokenNormalizado, termo, pesoBase) {
  if (termo === tokenNormalizado) return pesoBase * 2; // match exato
  if (termo.includes(tokenNormalizado) || tokenNormalizado.includes(termo)) {
    return pesoBase * 1.5; // substring (ex: "servid" dentro de "servidor virtual")
  }

  const candidatos = [termo, ...termo.split(' ')];
  let menorDistancia = Infinity;
  candidatos.forEach(c => {
    const d = distanciaLevenshtein(tokenNormalizado, c);
    if (d < menorDistancia) menorDistancia = d;
  });

  if (menorDistancia <= limiteToleravel(tokenNormalizado.length)) {
    return pesoBase; // aceito com tolerância a erro de digitação
  }
  return 0;
}

function investigarPorTexto() {
  const bruto = els.inputTextoLivre.value.trim();
  els.sugestaoTexto.textContent = '';

  if (!bruto) {
    mostrarMensagem(els.resultados, 'Digite ao menos uma palavra-chave para investigar.');
    return;
  }

  const tokens = bruto
    .split(/[,;]| e /i)
    .flatMap(parte => parte.trim().split(/\s+/))
    .map(normalizarTexto)
    .filter(Boolean);

  const pontuacoesPorServico = new Map();
  const tokensSemMatch = [];

  tokens.forEach(token => {
    let algumMatchNesteToken = false;

    estado.servicos.forEach(servico => {
      const termos = termosPesquisaveis(servico);
      let melhorPontuacaoToken = 0;
      termos.forEach(({ termo, peso }) => {
        const pontos = pontuarToken(token, termo, peso);
        if (pontos > melhorPontuacaoToken) melhorPontuacaoToken = pontos;
      });
      if (melhorPontuacaoToken > 0) {
        algumMatchNesteToken = true;
        const atual = pontuacoesPorServico.get(servico.id) || { servico, score: 0 };
        atual.score += melhorPontuacaoToken;
        pontuacoesPorServico.set(servico.id, atual);
      }
    });

    if (!algumMatchNesteToken) tokensSemMatch.push(token);
  });

  const ranking = [...pontuacoesPorServico.values()].sort((a, b) => b.score - a.score);

  if (ranking.length === 0) {
    const sugestao = sugerirPistaProxima(tokens);
    mostrarMensagem(
      els.resultados,
      'Nenhum serviço encontrado para esses termos. Tente outras palavras.'
    );
    if (sugestao) mostrarSugestao(sugestao);
    return;
  }

  renderizarResultados(ranking, Math.max(...ranking.map(r => r.score)));

  if (tokensSemMatch.length > 0) {
    const sugestao = sugerirPistaProxima(tokensSemMatch);
    if (sugestao) mostrarSugestao(sugestao);
  }
}

// Encontra, entre todas as pistas conhecidas, a mais próxima de algum
// token que não bateu, "você quis dizer...?".
function sugerirPistaProxima(tokens) {
  let melhor = null;
  tokens.forEach(token => {
    estado.pistasUnicas.forEach(pista => {
      const pistaNormalizada = normalizarTexto(pista);
      const candidatos = [pistaNormalizada, ...pistaNormalizada.split(' ')];
      const distancia = Math.min(...candidatos.map(c => distanciaLevenshtein(token, c)));
      if (!melhor || distancia < melhor.distancia) {
        melhor = { pista, distancia };
      }
    });
  });
  // só sugere se a distância for razoável, senão a sugestão vira ruído
  return melhor && melhor.distancia <= 3 ? melhor.pista : null;
}

function mostrarSugestao(pista) {
  els.sugestaoTexto.innerHTML = '';
  const texto = document.createTextNode('Você quis dizer: ');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = pista;
  btn.addEventListener('click', () => {
    els.inputTextoLivre.value = pista;
    investigarPorTexto();
  });
  els.sugestaoTexto.append(texto, btn, document.createTextNode('?'));
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

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .trim();
}

// Distância de Levenshtein: quantas edições (inserir/remover/trocar letra)
// separam duas strings. Quanto menor, mais parecidas.
function distanciaLevenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const linhaAnterior = Array.from({ length: n + 1 }, (_, j) => j);
  let linhaAtual = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    linhaAtual[0] = i;
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      linhaAtual[j] = Math.min(
        linhaAnterior[j] + 1,      // remoção
        linhaAtual[j - 1] + 1,     // inserção
        linhaAnterior[j - 1] + custo // substituição
      );
    }
    for (let j = 0; j <= n; j++) linhaAnterior[j] = linhaAtual[j];
  }
  return linhaAnterior[n];
}

// Quantos erros de digitação aceitar, proporcional ao tamanho da palavra.
function limiteToleravel(tamanho) {
  if (tamanho <= 4) return 1;
  if (tamanho <= 8) return 2;
  return 3;
}

init();

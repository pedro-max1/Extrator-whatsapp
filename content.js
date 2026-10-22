const esperar = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const SELETOR_MODAL = '[data-testid="contacts-modal"]';

const regexTelefone =
  /(?:\+55\s*)?(?:\(?\d{2}\)?[\s.-]*)?(?:\d{4,5})[-.\s]?\d{4}\b/g;

function normalizarTelefone(texto) {
  const digitos = texto.replace(/\D/g, "");

  if (
    digitos.startsWith("55") &&
    (digitos.length === 12 || digitos.length === 13)
  ) {
    return `+${digitos}`;
  }

  if (digitos.length === 10 || digitos.length === 11) {
    return `+55${digitos}`;
  }

  return null;
}

function encontrarNumeros(elemento) {
  const numeros = new Set();

  if (!elemento) {
    return numeros;
  }

  const spans = elemento.querySelectorAll(
    '[data-testid="cell-frame-secondary"] span[dir="auto"]'
  );

  for (const span of spans) {
    const texto = (
      span.innerText ||
      span.textContent ||
      ""
    ).trim();

    // Ignora textos que não parecem conter um telefone.
    if (!/[\d]/.test(texto)) {
      continue;
    }

    const correspondencias = texto.match(regexTelefone) || [];

    for (const correspondencia of correspondencias) {
      const telefone = normalizarTelefone(correspondencia);

      if (telefone) {
        numeros.add(telefone);
      }
    }
  }

  return numeros;
}

function encontrarAreasRolaveis() {
  const modal = document.querySelector(SELETOR_MODAL);

  if (!modal) {
    return [];
  }

  const elementos = [modal, ...modal.querySelectorAll("*")];

  return elementos.filter((elemento) => {
    const estilo = getComputedStyle(elemento);

    const podeRolar =
      /(auto|scroll)/.test(estilo.overflowY) &&
      elemento.scrollHeight > elemento.clientHeight + 30;

    return podeRolar && elemento.clientHeight > 100;
  });
}

function encontrarListaParticipantes(modal) {
  const itens = [
    ...modal.querySelectorAll(
      '[role="listitem"][data-testid^="list-item-"]'
    ),
  ];

  return itens;
}

async function lerParticipantes() {
  const modal = document.querySelector(SELETOR_MODAL);

  if (!modal) {
    return {
      sucesso: false,
      erro:
        'Janela de participantes não encontrada. Abra as informações do grupo e clique em "Ver tudo".',
    };
  }

  const areas = encontrarAreasRolaveis();

  if (areas.length === 0) {
    return {
      sucesso: false,
      erro:
        "Não encontrei uma área rolável na janela de participantes. Confira se a lista está aberta e carregada.",
    };
  }

  // Prioriza áreas dentro da janela que contenham itens de participantes.
  const candidatas = areas
    .map((elemento) => ({
      elemento,
      quantidadeItens: elemento.querySelectorAll(
        '[role="listitem"][data-testid^="list-item-"]'
      ).length,
      quantidadeNumeros: encontrarNumeros(elemento).size,
    }))
    .sort((a, b) => {
      if (b.quantidadeItens !== a.quantidadeItens) {
        return b.quantidadeItens - a.quantidadeItens;
      }

      return b.quantidadeNumeros - a.quantidadeNumeros;
    });

  const area = candidatas[0].elemento;
  const numeros = new Set();

  const limiteIteracoes = 250;
  let iteracoesSemAvanco = 0;
  let posicaoAnterior = -1;

  area.scrollTop = 0;
  await esperar(500);

  for (let i = 0; i < limiteIteracoes; i++) {
    // Confirma que a janela continua aberta.
    if (!document.querySelector(SELETOR_MODAL)) {
      break;
    }

    // Coleta os números atualmente renderizados na lista.
    for (const numero of encontrarNumeros(modal)) {
      numeros.add(numero);
    }

    const maximo = area.scrollHeight - area.clientHeight;

    if (area.scrollTop >= maximo - 2) {
      break;
    }

    if (area.scrollTop === posicaoAnterior) {
      iteracoesSemAvanco++;
    } else {
      iteracoesSemAvanco = 0;
    }

    if (iteracoesSemAvanco >= 4) {
      break;
    }

    posicaoAnterior = area.scrollTop;

    area.scrollTop = Math.min(
      area.scrollTop + Math.max(150, area.clientHeight * 0.7),
      maximo
    );

    await esperar(450);
  }

  // Captura os últimos participantes renderizados.
  for (const numero of encontrarNumeros(modal)) {
    numeros.add(numero);
  }

  const resultado = [...numeros].sort();

  if (resultado.length === 0) {
    return {
      sucesso: false,
      erro:
        "Nenhum telefone foi encontrado. Verifique se os números estão visíveis na lista de participantes.",
    };
  }

  return {
    sucesso: true,
    numeros: resultado,
    mensagem:
      `Leitura finalizada: ${resultado.length} números únicos encontrados. ` +
      "Confira a lista antes de exportar o CSV.",
  };
}

chrome.runtime.onMessage.addListener(
  (mensagem, remetente, responder) => {
    if (mensagem.tipo !== "INICIAR_LEITURA") {
      return;
    }

    lerParticipantes()
      .then(responder)
      .catch((erro) => {
        console.error("Erro ao ler participantes:", erro);

        responder({
          sucesso: false,
          erro:
            "Ocorreu um erro durante a leitura. Confira se a janela de participantes está aberta e tente novamente.",
        });
      });

    return true;
  }
);
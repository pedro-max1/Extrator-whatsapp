const botaoIniciar = document.getElementById("iniciar");
const botaoExportar = document.getElementById("exportar");
const status = document.getElementById("status");
const contador = document.getElementById("contador");

let numerosEncontrados = [];

botaoIniciar.addEventListener("click", async () => {
  status.textContent = "Verificando a página do WhatsApp Web...";
  botaoIniciar.disabled = true;

  try {
    const [aba] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (
      !aba?.id ||
      !aba.url?.startsWith("https://web.whatsapp.com/")
    ) {
      throw new Error("Abra o WhatsApp Web no Chrome.");
    }

    const resposta = await chrome.tabs.sendMessage(aba.id, {
      tipo: "INICIAR_LEITURA"
    });

    if (!resposta?.sucesso) {
      throw new Error(
        resposta?.erro || "Não foi possível iniciar a leitura."
      );
    }

    numerosEncontrados = resposta.numeros || [];

    contador.textContent =
      `Números encontrados: ${numerosEncontrados.length}`;

    status.textContent = resposta.mensagem;
    botaoExportar.disabled = numerosEncontrados.length === 0;

  } catch (erro) {
    status.textContent =
      erro.message ||
      "Erro ao comunicar com o WhatsApp Web. Recarregue a página e tente novamente.";

  } finally {
    botaoIniciar.disabled = false;
  }
});

botaoExportar.addEventListener("click", async () => {
  if (numerosEncontrados.length === 0) {
    status.textContent = "Nenhum número disponível para exportação.";
    return;
  }

  // Cada telefone será apresentado em sua própria célula.
  // O formato de fórmula ajuda o Excel a preservar o sinal +.
  const linhas = [
    "Telefone",
    ...numerosEncontrados.map(numero => `="${numero}"`)
  ];

  // BOM UTF-8 para melhorar a compatibilidade com o Excel.
  const conteudo = "\uFEFF" + linhas.join("\r\n");

  const arquivo = new Blob([conteudo], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(arquivo);

  try {
    await chrome.downloads.download({
      url,
      filename: "telefones_participantes.csv",
      saveAs: true
    });

    status.textContent = "Exportação solicitada.";

  } catch (erro) {
    status.textContent = "Não foi possível exportar o CSV.";

  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
});
async function carregarHabilidades() {
  const urlJogadores = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSpYqMuzSsXqjixKp0a4eTsuoaqtQMwfnqXsXb8w5z3gIrUt4yO5oQPTBgP8BnSwQ-8in26XBEjiWVL/pub?gid=557483612&single=true&output=csv'
  const response = await fetch(urlJogadores);
  const csv = await response.text();
  const dados = Papa.parse(csv, { header: true }).data;
  window.todosJogadores = dados;
  renderizarJogadores(dados);
}

function filtrarPorPosicao() {
  const filtro = document.getElementById("filtro-posicao").value;
  const filtrados = filtro === "TODOS" ? window.todosJogadores : window.todosJogadores.filter(j => j["Posição"] === filtro);
  renderizarJogadores(filtrados);
}

function renderizarJogadores(dados) {
  const container = document.getElementById("jogadoresContainer");
  container.innerHTML = "";
  dados.forEach((jogador, i) => {
    const mediaHabilidades = Math.round(calcularMedia(jogador));

    const col = document.createElement("div");
    col.className = "col-md-4 mb-4";
    col.innerHTML = `
      <div class="card shadow-lg p-3">
        <div class="text-center position-relative">
          <img src="images/${jogador.Nome.toLowerCase()}.png"
          onerror="this.src='https://via.placeholder.com/90'"
          class="rounded-circle mb-2"
          width="90"
          height="97">
          <div class="media-label position-absolute top-0 end-0 bg-success text-white rounded-pill px-2 py-1" style="font-size: 0.75rem;">
            ${mediaHabilidades}
          </div>
          <h6>
            ${jogador.Nome}
            <span class="badge rounded-pill ${corDaPosicao(jogador.Posição)}">${jogador.Posição}</span>
          </h6>
          <canvas id="radar${i}" class="radar-canvas"></canvas>
        </div>
      </div>
    `;
    container.appendChild(col);

    const ctx = document.getElementById(`radar${i}`).getContext("2d");
    new Chart(ctx, {
      type: "radar",
      data: {
        labels: ["Ritmo", "Finalização", "Passe", "Drible", "Defesa", "Físico"],
        datasets: [{
          data: [
            jogador.Ritmo,
            jogador.Finalização,
            jogador.Passe,
            jogador.Drible,
            jogador.Defesa,
            jogador.Físico
          ],
          backgroundColor: "rgba(0,123,255,0.2)",
          borderColor: "rgba(0,123,255,0.9)",
          pointBackgroundColor: "rgba(0,123,255,1)"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.1,
        plugins: {
          legend: { display: false }
        },
        scales: {
          r: {
            angleLines: { display: false },
            suggestedMin: 0,
            suggestedMax: 100,
            ticks: { display: false },
            grid: {
              color: "rgba(0, 123, 255, 0.1)",
              lineWidth: 1
            }
          }
        }
      }
    });
  });
}

function calcularMedia(jogador) {
  const atributos = {
    Ritmo: jogador.Ritmo,
    Finalização: jogador.Finalização,
    Passe: jogador.Passe,
    Drible: jogador.Drible,
    Defesa: jogador.Defesa,
    Físico: jogador.Físico
  };

  const pesos = {
    Ritmo: 1,
    Finalização: 1,
    Passe: 1,
    Drible: 1,
    Defesa: 1,
    Físico: 1
  };

  // Regras de aumento de peso por posição
  switch (jogador.Posição) {
    case "ATA":
      pesos.Finalização += 0.45;
      pesos.Drible += 0.30;
      pesos.Físico += 0.25;
      break;
    case "MEI":
      pesos.Passe += 0.45;
      pesos.Drible += 0.35;
      pesos.Ritmo += 0.20;
      break;
    case "ZAG":
      pesos.Físico += 0.35;
      pesos.Defesa += 0.45;
      pesos.Ritmo += 0.20;
      break;
    case "GOL":
      pesos.Defesa += 0.85;
      pesos.Físico += 0.10;
      pesos.Passe += 0.05;
      break;
  }

  let somaPesos = 0;
  let somaNotas = 0;

  for (const atributo in atributos) {
    somaNotas += atributos[atributo] * pesos[atributo];
    somaPesos += pesos[atributo];
  }

  return somaNotas / somaPesos;
}

// Função para evoluir habilidades dos jogadores ao longo dos jogos (não utilizada ainda)
function evoluirHabilidades(jogador, partidasJogadas = 1) {
  // Exemplo simples: cada partida aumenta um pouco cada atributo, até um máximo de 100
  const incremento = 0.2 * partidasJogadas;
  const atributos = ["Ritmo", "Finalização", "Passe", "Drible", "Defesa", "Físico"];
  atributos.forEach(attr => {
    let valorAtual = Number(jogador[attr]) || 0;
    jogador[attr] = Math.min(100, valorAtual + incremento);
  });
  // Retorna o jogador atualizado (opcional)
  return jogador;
}

function corDaPosicao(posicao) {
  switch (posicao) {
    case "ATA": return "bg-danger";
    case "ZAG": return "bg-warning text-dark";
    case "MEI": return "bg-primary";
    case "GOL": return "bg-secondary";
    default: return "bg-dark";
  }
}

window.addEventListener("load", carregarHabilidades);

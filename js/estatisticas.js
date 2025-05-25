async function carregarJogadores() {
  const urlJogadores = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSpYqMuzSsXqjixKp0a4eTsuoaqtQMwfnqXsXb8w5z3gIrUt4yO5oQPTBgP8BnSwQ-8in26XBEjiWVL/pub?gid=557483612&single=true&output=csv'
  const response = await fetch(urlJogadores);
  const csv = await response.text();
  const dados = Papa.parse(csv, { header: true }).data;


  // Ordenar e limitar os 5 primeiros por presenças
  const topPresencas = [...dados]
    .sort((a, b) => b.Presencas - a.Presencas)
    .slice(0, 3);

  const topGols = [...dados]
    .sort((a, b) => b.Gols - a.Gols)
    .slice(0, 3);

  const nomesPresencas = topPresencas.map(d => d.Nome);
  const presencas = topPresencas.map(d => +d.Presencas);

  const nomesGols = topGols.map(d => d.Nome);
  const gols = topGols.map(d => +d.Gols);

  const pluginImagens = {
    id: 'pluginImagensTopo',
    afterDatasetsDraw(chart) {
      const { ctx, data, scales: { x, y } } = chart;

      data.labels.forEach((label, index) => {
        const nomeFormatado = label.toLowerCase();
        const img = new Image();
        img.src = `images/${nomeFormatado}.png`;

        img.onload = () => {
          const xPos = x.getPixelForValue(index);
          const yPos = y.getPixelForValue(chart.data.datasets[0].data[index]) - 40;

          ctx.save();
          ctx.beginPath();
          ctx.arc(xPos, yPos + 30, 30, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, xPos - 25, yPos, 50, 60);
          ctx.restore();
        };
      });
    }
  };

  const pluginRotuloPill = {
    id: 'pluginRotuloPill',
    afterDatasetsDraw(chart) {
      const { ctx, data, scales: { x, y } } = chart;
      const dataset = chart.data.datasets[0];

      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      dataset.data.forEach((value, index) => {
        const xPos = x.getPixelForValue(index);
        const yPos = y.getPixelForValue(value) - 45;

        const paddingX = 8;
        const label = value.toString();
        const textWidth = ctx.measureText(label).width;

        ctx.fillStyle = chart.canvas.id === 'graficoAssiduos' ? 'rgba(6,114,185,0.8)' : 'rgba(31,229,34,0.78)';
        ctx.beginPath();
        const radius = 12;
        const pillWidth = textWidth + paddingX * 2;
        const pillHeight = 24;
        const left = xPos - pillWidth / 2;
        const top = yPos - pillHeight;

        ctx.moveTo(left + radius, top);
        ctx.arcTo(left + pillWidth, top, left + pillWidth, top + pillHeight, radius);
        ctx.arcTo(left + pillWidth, top + pillHeight, left, top + pillHeight, radius);
        ctx.arcTo(left, top + pillHeight, left, top, radius);
        ctx.arcTo(left, top, left + pillWidth, top, radius);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.fillText(label, xPos, top + pillHeight / 2);
      });
    }
  };

  const configChart = (ctx, titulo, dados, cor, labels) => new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: titulo,
        data: dados,
        backgroundColor: cor,
        barPercentage: 0.15
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: titulo,
          font: { size: 18 },
          padding: { top: 0, bottom: 75 }
        }
      },
      layout: {
        padding: { top: 0 }
      },
      scales: {
        x: {
          grid: { display: false },
          categoryPercentage: 0.6
        },
        y: {
          grid: { display: false },
          ticks: { display: false },
          border: { display: false }
        }
      }
    },
    plugins: [pluginImagens, pluginRotuloPill]
  });

  const ctx1 = document.getElementById('graficoAssiduos').getContext('2d');
  configChart(ctx1, 'Jogadores Mais Assíduos', presencas, 'rgba(6, 114, 185, 0.8)', nomesPresencas);

  const ctx2 = document.getElementById('graficoGols').getContext('2d');
  configChart(ctx2, 'Ranking de Goleadores', gols, 'rgba(31, 229, 34, 0.78)', nomesGols);
}

window.addEventListener("load", carregarJogadores);

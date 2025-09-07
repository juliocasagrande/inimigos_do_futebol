async function carregarJogadores() {
  try {
    const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSpYqMuzSsXqjixKp0a4eTsuoaqtQMwfnqXsXb8w5z3gIrUt4yO5oQPTBgP8BnSwQ-8in26XBEjiWVL/pub?gid=557483612&single=true&output=csv';
    const response = await fetch(url);
    const csv = await response.text();
    const dadosRaw = Papa.parse(csv, { header: true }).data;

    // Limpeza e tipagem
    const dados = dadosRaw
      .filter(d => d && d.Nome) // remove linhas vazias
      .map(d => ({
        ...d,
        Presencas: d.Presencas ? +d.Presencas : 0,
        Gols: d.Gols ? +d.Gols : 0
      }));

    // TOP assíduos (7)
    const topPresencas = [...dados]
      .filter(d => d.Nome && Number.isFinite(d.Presencas))
      .sort((a, b) => b.Presencas - a.Presencas)
      .slice(0, 7);

    // TOP gols (5) - exceto goleiros
    const topGols = [...dados]
      .filter(d => d.Nome && Number.isFinite(d.Gols) && d.Posição !== "GOL")
      .sort((a, b) => b.Gols - a.Gols)
      .slice(0, 5);

    // Goleiros (2) – ordenados por "defesas difíceis" (aqui usei Gols do CSV como exemplo)
    const dataGoleiros = dados
      .filter(j => j.Posição === "GOL" && Number.isFinite(j.Gols))
      .map(j => ({
        name: j.Nome,
        steps: j.Gols,
        pictureSettings: { src: `images/${j.Nome.toLowerCase()}.png` }
      }))
      .sort((a, b) => b.steps - a.steps)
      .slice(0, 2);

    // Data para gráficos
    const dataPresencas = topPresencas.map(j => ({
      name: j.Nome,
      steps: j.Presencas,
      pictureSettings: { src: `images/${j.Nome.toLowerCase()}.png` }
    }));

    const dataGols = topGols.map(j => ({
      name: j.Nome,
      steps: j.Gols,
      pictureSettings: { src: `images/${j.Nome.toLowerCase()}.png` }
    }));

    am5.ready(function () {
      // ================= GRÁFICO 1: Assíduos =================
      const root1 = am5.Root.new("graficoAssiduos");
      root1.setThemes([am5themes_Animated.new(root1)]);

      const chart1 = root1.container.children.push(am5xy.XYChart.new(root1, {
        panX: false, panY: false, wheelX: "none", wheelY: "none",
        paddingTop: 65, paddingBottom: 20, paddingLeft: 20, paddingRight: 20
      }));

      chart1.children.unshift(am5.Label.new(root1, {
        text: "📅 Mais fominhas",
        fontSize: 20, fontWeight: "600",
        x: 0, centerX: am5.left, y: 0, centerY: am5.top,
        paddingTop: 10, paddingLeft: 10, fill: am5.color(0x333333)
      }));

      const xAxis1 = chart1.xAxes.push(am5xy.CategoryAxis.new(root1, {
        categoryField: "name",
        renderer: am5xy.AxisRendererX.new(root1, { minGridDistance: 30 })
      }));
      xAxis1.get("renderer").grid.template.set("visible", false);
      xAxis1.get("renderer").labels.template.setAll({
        dy: 0, paddingTop: 40, fontSize: 14, fill: am5.color(0x000000)
      });

      const yAxis1 = chart1.yAxes.push(am5xy.ValueAxis.new(root1, {
        min: 0, renderer: am5xy.AxisRendererY.new(root1, {})
      }));
      yAxis1.get("renderer").grid.template.set("visible", false);
      yAxis1.set("visible", false);
      yAxis1.set("extraMax", 0.15); // folga no topo

      const series1 = chart1.series.push(am5xy.ColumnSeries.new(root1, {
        name: "Presenças",
        xAxis: xAxis1, yAxis: yAxis1,
        valueYField: "steps", categoryXField: "name",
        sequencedInterpolation: true, calculateAggregates: true,
        maskBullets: false,
        tooltip: am5.Tooltip.new(root1, { labelText: "{valueY}", pointerOrientation: "vertical", dy: -10 })
      }));

      series1.columns.template.setAll({
        strokeOpacity: 0, cornerRadiusTL: 10, cornerRadiusTR: 10,
        maxWidth: 50, fillOpacity: 0.9
      });

      const cursor1 = chart1.set("cursor", am5xy.XYCursor.new(root1, {}));
      cursor1.lineX.set("visible", false);
      cursor1.lineY.set("visible", false);

      const circleTemplate1 = am5.Template.new({});
      series1.bullets.push(function () {
        const container = am5.Container.new(root1, {});
        container.children.push(am5.Circle.new(root1, { radius: 34 }, circleTemplate1));
        const mask = am5.Circle.new(root1, { radius: 27 });
        container.children.push(mask);
        const imageContainer = am5.Container.new(root1, { mask: mask });
        imageContainer.children.push(am5.Picture.new(root1, {
          templateField: "pictureSettings",
          centerX: am5.p50, centerY: am5.p50, width: 45, height: 60
        }));
        container.children.push(imageContainer);
        return am5.Bullet.new(root1, { locationY: 0, sprite: container });
      });

      // Rótulos visíveis acima das barras
      series1.bullets.push(function () {
        return am5.Bullet.new(root1, {
          locationY: 1,
          sprite: am5.Label.new(root1, {
            text: "{valueY}", populateText: true,
            fontSize: 14, fill: am5.color(0x000000),
            centerX: am5.p50, centerY: am5.bottom, dy: -6
          })
        });
      });

      series1.set("heatRules", [
        {
          target: series1.columns.template, key: "fill", dataField: "valueY",
          min: am5.color(0xadd8e6), max: am5.color(0x003366), minOpacity: 0.4, maxOpacity: 0.9
        },
        {
          target: circleTemplate1, key: "fill", dataField: "valueY",
          min: am5.color(0xadd8e6), max: am5.color(0x003366), minOpacity: 0.4, maxOpacity: 0.9
        }
      ]);

      series1.data.setAll(dataPresencas);
      xAxis1.data.setAll(dataPresencas);
      series1.appear(); chart1.appear(1000, 100);

      // ================= GRÁFICO 2: Artilheiros =================
      const root2 = am5.Root.new("graficoGols");
      root2.setThemes([am5themes_Animated.new(root2)]);

      const chart2 = root2.container.children.push(am5xy.XYChart.new(root2, {
        panX: false, panY: false, wheelX: "none", wheelY: "none",
        paddingTop: 65, paddingLeft: 0, paddingRight: 30
      }));

      chart2.children.unshift(am5.Label.new(root2, {
        text: "⚽ Artilheiros",
        fontSize: 20, fontWeight: "600",
        x: 0, centerX: am5.left, y: 0, centerY: am5.top,
        paddingTop: 10, paddingLeft: 10, fill: am5.color(0x333333)
      }));

      const yRenderer2 = am5xy.AxisRendererY.new(root2, { inversed: true });
      const yAxis2 = chart2.yAxes.push(am5xy.CategoryAxis.new(root2, {
        categoryField: "name", renderer: yRenderer2, paddingRight: 40
      }));
      yAxis2.get("renderer").grid.template.set("visible", false);

      const xRenderer2 = am5xy.AxisRendererX.new(root2, {});
      const xAxis2 = chart2.xAxes.push(am5xy.ValueAxis.new(root2, {
        min: 0, renderer: xRenderer2
      }));
      // Oculta labels/linha de eixo via setters apropriados
      xAxis2.get("renderer").labels.template.set("visible", false);
      xAxis2.get("renderer").grid.template.set("visible", false);
      xAxis2.get("renderer").line.set("visible", false);
      xAxis2.set("extraMax", 0.15); // folga à direita para os labels

      const series2 = chart2.series.push(am5xy.ColumnSeries.new(root2, {
        name: "Gols",
        xAxis: xAxis2, yAxis: yAxis2,
        valueXField: "steps", categoryYField: "name",
        sequencedInterpolation: true, calculateAggregates: true,
        maskBullets: false,
        tooltip: am5.Tooltip.new(root2, { labelText: "{valueX}", pointerOrientation: "right", dy: 0 })
      }));

      series2.columns.template.setAll({
        strokeOpacity: 0, cornerRadiusTR: 10, cornerRadiusBR: 10,
        maxHeight: 50, fillOpacity: 0.9
      });

      series2.bullets.push(function () {
        const container = am5.Container.new(root2, {});
        container.children.push(am5.Circle.new(root2, { radius: 34 }, am5.Template.new({})));
        const mask = am5.Circle.new(root2, { radius: 27 });
        container.children.push(mask);
        const imageContainer = am5.Container.new(root2, { mask: mask });
        imageContainer.children.push(am5.Picture.new(root2, {
          templateField: "pictureSettings",
          centerX: am5.p50, centerY: am5.p50, width: 45, height: 60
        }));
        container.children.push(imageContainer);
        return am5.Bullet.new(root2, { locationX: 0, sprite: container });
      });

      // Rótulos sempre visíveis à direita das barras
      series2.bullets.push(function () {
        return am5.Bullet.new(root2, {
          locationX: 1,
          sprite: am5.Label.new(root2, {
            text: "{valueX}", populateText: true,
            fontSize: 14, fill: am5.color(0x000000),
            centerY: am5.p50, centerX: am5.left, dx: 10
          })
        });
      });

      series2.set("heatRules", [
        {
          target: series2.columns.template, key: "fill", dataField: "valueX",
          min: am5.color(0xadd8e6), max: am5.color(0x003366), minOpacity: 0.4, maxOpacity: 0.9
        }
      ]);

      series2.data.setAll(dataGols);
      yAxis2.data.setAll(dataGols);
      series2.appear(); chart2.appear(1000, 100);

      // ================= GRÁFICO 3: Goleiros =================
      const root3 = am5.Root.new("graficoGoleiros");
      root3.setThemes([am5themes_Animated.new(root3)]);

      const chart3 = root3.container.children.push(am5xy.XYChart.new(root3, {
        panX: false, panY: false, wheelX: "none", wheelY: "none",
        paddingTop: 65, paddingBottom: 20, paddingLeft: 20, paddingRight: 20
      }));

      chart3.children.unshift(am5.Label.new(root3, {
        text: "🧤 Muralhas da Pelada!!",
        fontSize: 20, fontWeight: "600",
        x: 0, centerX: am5.left, y: 0, centerY: am5.top,
        paddingTop: 10, paddingLeft: 10, fill: am5.color(0x333333)
      }));

      const xAxis3 = chart3.xAxes.push(am5xy.CategoryAxis.new(root3, {
        categoryField: "name",
        renderer: am5xy.AxisRendererX.new(root3, { minGridDistance: 30 })
      }));
      xAxis3.get("renderer").grid.template.set("visible", false);
      xAxis3.get("renderer").labels.template.setAll({
        dy: 0, paddingTop: 40, fontSize: 14, fill: am5.color(0x000000)
      });

      const yAxis3 = chart3.yAxes.push(am5xy.ValueAxis.new(root3, {
        min: 0, renderer: am5xy.AxisRendererY.new(root3, {})
      }));
      yAxis3.get("renderer").grid.template.set("visible", false);
      yAxis3.set("visible", false);
      yAxis3.set("extraMax", 0.15); // folga no topo

      const series3 = chart3.series.push(am5xy.ColumnSeries.new(root3, {
        name: "Defesas Difíceis",
        xAxis: xAxis3, yAxis: yAxis3,
        valueYField: "steps", categoryXField: "name",
        sequencedInterpolation: true, calculateAggregates: true,
        maskBullets: false,
        tooltip: am5.Tooltip.new(root3, { labelText: "{valueY}", pointerOrientation: "vertical", dy: -10 })
      }));

      series3.columns.template.setAll({
        strokeOpacity: 0, cornerRadiusTL: 10, cornerRadiusTR: 10,
        maxWidth: 50, fillOpacity: 0.9
      });

      series3.bullets.push(function () {
        const container = am5.Container.new(root3, {});
        container.children.push(am5.Circle.new(root3, { radius: 34 }, am5.Template.new({})));
        const mask = am5.Circle.new(root3, { radius: 27 });
        container.children.push(mask);
        const imageContainer = am5.Container.new(root3, { mask: mask });
        imageContainer.children.push(am5.Picture.new(root3, {
          templateField: "pictureSettings",
          centerX: am5.p50, centerY: am5.p50, width: 45, height: 60
        }));
        container.children.push(imageContainer);
        return am5.Bullet.new(root3, { locationY: 0, sprite: container });
      });

      // Rótulos visíveis acima das barras
      series3.bullets.push(function () {
        return am5.Bullet.new(root3, {
          locationY: 1,
          sprite: am5.Label.new(root3, {
            text: "{valueY}", populateText: true,
            fontSize: 14, fill: am5.color(0x000000),
            centerX: am5.p50, centerY: am5.bottom, dy: -6
          })
        });
      });

      series3.set("heatRules", [
        {
          target: series3.columns.template, key: "fill", dataField: "valueY",
          min: am5.color(0xc8facc), max: am5.color(0x006400),
          minOpacity: 0.4, maxOpacity: 0.9
        }
      ]);

      series3.data.setAll(dataGoleiros);
      xAxis3.data.setAll(dataGoleiros);
      series3.appear(); chart3.appear(1000, 100);
    });
  } catch (e) {
    console.error("Erro ao carregar jogadores:", e);
  }
}

window.addEventListener("load", carregarJogadores);
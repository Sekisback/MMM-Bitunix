// Node Helper für HTTP API Requests
const NodeHelper = require("node_helper");
const Log = require("logger");
const axios = require("axios");

module.exports = NodeHelper.create({
  // Helper starten
  start() {
    this.instanceIds = {};
  },

  // Socket-Benachrichtigungen empfangen
  socketNotificationReceived(notification, payload) {
    // Ticker-Anfrage verarbeiten
    if (notification === "BITUNIX_REQUEST_TICKERS") {
      this.fetchTickers(payload.stocks);
    }
  },

  // Tickers von API holen (korrekt mit 24h-Kline)
  async fetchTickers(stocks) {
    try {
      //console.log("[MMM-Bitunix Node] Hole Tickers für:", stocks.map(s => s.symbol).join(","));
      const symbols = stocks.map(s => s.symbol).join(",");

      // Aktuelle Ticker-Daten
      const tickerRes = await axios.get("https://fapi.bitunix.com/api/v1/futures/market/tickers", {
        params: { symbols }
      });
      const tickerData = tickerRes.data?.data || [];
      //console.log("[MMM-Bitunix Node] Ticker Response:", tickerData.length, "Einträge");

      // Zeitstempel: vor 24 Stunden in Millisekunden
      const endTime = Date.now() - 24 * 60 * 60 * 1000;

      const formattedStocks = await Promise.all(
        tickerData.map(async ticker => {
          try {
            // 1m-Kerze vor 24 Stunden holen
            const klineRes = await axios.get(
              "https://fapi.bitunix.com/api/v1/futures/market/kline",
              {
                params: {
                  symbol: ticker.symbol,
                  interval: "1m",
                  limit: 1,
                  endTime: endTime,
                  type: "LAST_PRICE"
                }
              }
            );

            // Format laut API-Doku: data[0].close
            const close24h = parseFloat(klineRes.data?.data?.[0]?.close);
            const lastPrice = parseFloat(ticker.lastPrice);

            const changePercent =
              close24h > 0 ? ((lastPrice - close24h) / close24h) * 100 : 0;

            //console.log(`[MMM-Bitunix Node] ${ticker.symbol}: close24h=${close24h}, last=${lastPrice}, Δ=${changePercent.toFixed(2)}%`);

            return {
              symbol: ticker.symbol,
              lastPrice,
              changePercent: parseFloat(changePercent.toFixed(2)),
              highPrice: parseFloat(ticker.high),
              lowPrice: parseFloat(ticker.low),
              volumeBase: parseFloat(ticker.baseVol),
              volumeQuote: parseFloat(ticker.quoteVol)
            };
          } catch (err) {
            console.warn(`[MMM-Bitunix Node] Fehler bei 24h-Kline für ${ticker.symbol}:`, err.message);
            return {
              symbol: ticker.symbol,
              lastPrice: parseFloat(ticker.lastPrice),
              changePercent: 0,
              highPrice: parseFloat(ticker.high),
              lowPrice: parseFloat(ticker.low),
              volumeBase: parseFloat(ticker.baseVol),
              volumeQuote: parseFloat(ticker.quoteVol)
            };
          }
        })
      );

      // Antwort zurück an Frontend
      this.sendSocketNotification("BITUNIX_TICKERS_RESPONSE", {
        stocks: formattedStocks,
        lastUpdate: Date.now()
      });

      //Log.info("[MMM-Bitunix] Tickers aktualisiert");
    } catch (error) {
      Log.error("[MMM-Bitunix] API Error:", error.message);
    }
  }

});
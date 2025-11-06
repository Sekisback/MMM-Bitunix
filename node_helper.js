const NodeHelper = require("node_helper");
const Log = require("logger");
const WebSocket = require("ws");

module.exports = NodeHelper.create({
  start() {
    this.ws = null;
    this.symbols = [];
    this.instanceIds = {};
  },

  socketNotificationReceived(notification, payload) {
    // Identify module instance and configured symbols
    if (notification.includes("BITUNIX_TICKER_REQUEST")) {
      const parts = notification.split("-");
      const instanceId = parts.slice(1).join("-");
      const configStocks = payload.stocks || [];

      this.symbols = configStocks.map((s) => s.symbol.toUpperCase());
      this.currentInstanceId = instanceId;

      this.startWebSocket();
    }
  },

  startWebSocket() {
    // Avoid duplicate connections
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const url = "wss://fapi.bitunix.com/public/";
    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      // Subscribe to ticker channels
      const subMsg = {
        op: "subscribe",
        args: this.symbols.map((symbol) => ({
          symbol,
          ch: "tickers"
        }))
      };
      this.ws.send(JSON.stringify(subMsg));
    });

    this.ws.on("message", (msg) => {
      try {
        const message = JSON.parse(msg);
        if (message.ch === "tickers" && Array.isArray(message.data)) {
          this.processTickerData(message.data);
        }
      } catch (err) {
        Log.error("[MMM-Bitunix] JSON parse error:", err.message);
      }
    });

    this.ws.on("close", () => {
      Log.warn("[MMM-Bitunix] WebSocket closed, reconnecting in 5s…");
      setTimeout(() => this.startWebSocket(), 5000);
    });

    this.ws.on("error", (err) => {
      Log.error(`[MMM-Bitunix] WebSocket error: ${err.message}`);
    });
  },

  processTickerData(dataArray) {
    const formattedData = {
      lastUpdate: Date.now(),
      stocks: []
    };

    for (const d of dataArray) {
      formattedData.stocks.push({
        symbol: d.s || "N/A",
        lastPrice: parseFloat(d.la) || 0,
        openPrice: parseFloat(d.o) || 0,
        highPrice: parseFloat(d.h) || 0,
        lowPrice: parseFloat(d.l) || 0,
        volumeBase: parseFloat(d.b) || 0,
        volumeQuote: parseFloat(d.q) || 0,
        changePercent: parseFloat(d.r) || 0,
        bid: parseFloat(d.bd) || 0,
        ask: parseFloat(d.ak) || 0,
        bidVol: parseFloat(d.bv) || 0,
        askVol: parseFloat(d.av) || 0
      });
    }

    // Send formatted update back to the module instance
    const notificationName = `BITUNIX_TICKER_RESPONSE-${this.currentInstanceId}`;
    this.sendSocketNotification(notificationName, formattedData);
  }
});

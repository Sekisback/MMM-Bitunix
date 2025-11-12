Module.register("MMM-Bitunix", {
  defaults: {
    stocks: [],
    display_duration: 5, // Sekunden sichtbar
    showChangePercent: true,
    updateInterval: 30000
  },

  getStyles() {
    return ["MMM-Bitunix.css"];
  },

  getTemplate() {
    return "templates/MMM-Bitunix.njk";
  },

  start() {
    this.state = { stocks: [], lastUpdate: null };
    this.currentIndex = 0;
    this.currentStock = null;
    this.rotationInterval = null;

    console.log("[MMM-Bitunix] Config:", this.config);

    if (!this.config.stocks || this.config.stocks.length === 0) {
      console.warn("[MMM-Bitunix] No stocks defined in config.js");
      return;
    }

    this.sendSocketNotification("BITUNIX_REQUEST_TICKERS", {
      stocks: this.config.stocks
    });
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "BITUNIX_TICKERS_RESPONSE") {
      if (!payload || !payload.stocks) return;

      this.state.stocks = payload.stocks;
      this.state.lastUpdate = payload.lastUpdate;

      if (!this.rotationInterval) {
        this.currentIndex = 0;
        this.currentStock = this.state.stocks[this.currentIndex];
        this.updateDom(0);
        this.startRotation();
      } else {
        payload.stocks.forEach(newStock => {
          const existing = this.state.stocks.find(s => s.symbol === newStock.symbol);
          if (existing) {
            existing.lastPrice = newStock.lastPrice;
            existing.changePercent = newStock.changePercent;
          }
        });
        this.state.lastUpdate = payload.lastUpdate;
        this.updatePriceInDOM();
      }
    }
  },

  startRotation() {
    if (!this.state.stocks || this.state.stocks.length === 0) return;

    const visibleTime = this.config.display_duration * 1000;
    const fadeTime = 1000; // 0.5 s

    setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.state.stocks.length;
      this.currentStock = this.state.stocks[this.currentIndex];
      this.updateDom(fadeTime);

      if (this.currentIndex === 0) {
        this.sendSocketNotification("BITUNIX_REQUEST_TICKERS", {
          stocks: this.config.stocks
        });
      }
    }, visibleTime);
  },

  getDecimals(price) {
    if (price < 1) return 6;
    if (price < 10) return 4;
    if (price < 100) return 3;
    return 2;
  },

  updatePriceInDOM() {
    const priceSpan = document.querySelector(".MMM-Bitunix .price");
    const changeSpan = document.querySelector(".MMM-Bitunix .change");
    const itemDiv = document.querySelector(".MMM-Bitunix .bitunix-item");

    if (priceSpan && this.currentStock) {
      const decimals = this.getDecimals(this.currentStock.lastPrice);
      priceSpan.textContent = this.currentStock.lastPrice.toFixed(decimals);
    }

    if (changeSpan && this.currentStock) {
      changeSpan.textContent = `(${this.currentStock.changePercent.toFixed(2)}%)`;
    }

    if (itemDiv) {
      itemDiv.classList.remove("positive", "negative", "neutral");
      const colorClass =
        this.currentStock.changePercent > 0
          ? "positive"
          : this.currentStock.changePercent < 0
          ? "negative"
          : "neutral";
      itemDiv.classList.add(colorClass);
    }
  },

  getTemplateData() {
    if (!this.currentStock) return { config: this.config, stock: null };

    const decimals = this.getDecimals(this.currentStock.lastPrice);
    return {
      config: this.config,
      stock: {
        ...this.currentStock,
        decimals,
        cleanSymbol: this.currentStock.symbol.replace("USDT", "")
      },
      lastUpdate: this.state.lastUpdate
        ? moment(this.state.lastUpdate).format("HH:mm:ss")
        : null
    };
  }
});

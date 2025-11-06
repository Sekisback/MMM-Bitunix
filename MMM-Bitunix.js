Module.register("MMM-Bitunix", {
  defaults: {
    stocks: [],
    showChangePercent: true,
    scrollSpeed: 0
  },

  getStyles() {
    return ["MMM-Bitunix.css"];
  },

  getTemplate() {
    return "templates/MMM-Bitunix.njk";
  },

  start() {
    this.state = { stocks: [], lastUpdate: null };
    this.initialRender = true;

    // Warn if no symbols configured
    if (!this.config.stocks || this.config.stocks.length === 0) {
      Log.warn("[MMM-Bitunix] No stocks defined in config.js");
      return;
    }

    // Request initial data from node helper
    this.sendSocketNotification(`BITUNIX_TICKER_REQUEST-${this.identifier}`, {
      stocks: this.config.stocks
    });
  },

  socketNotificationReceived(notification, payload) {
    const expected = `BITUNIX_TICKER_RESPONSE-${this.identifier}`;
    
    if (notification === expected) {
      this.state = payload;
      
      if (this.initialRender) {
        this.updateDom();
        this.initialRender = false;
      } else {
        this.updateValues();
      }
    }
  },

  updateValues() {
    if (!this.state.stocks || this.state.stocks.length === 0) return;

    const allItems = document.querySelectorAll(".bitunix-item");
    if (!allItems.length) return;

    // Map DOM items by symbol
    const itemMap = {};
    allItems.forEach(item => {
      const symbol = item.dataset.symbol ? item.dataset.symbol.toUpperCase() : null;
      if (!symbol) return;
      if (!itemMap[symbol]) itemMap[symbol] = [];
      itemMap[symbol].push(item);
    });

    // Update values in DOM
    this.state.stocks.forEach(stock => {
      const symbol = stock.symbol ? stock.symbol.toUpperCase() : null;
      const targets = itemMap[symbol];
      if (!targets) return;

      targets.forEach(item => {
        const priceSpan = item.querySelector(".price");
        const changeSpan = item.querySelector(".change");

        if (priceSpan) priceSpan.textContent = stock.lastPrice?.toFixed(2) ?? "--";
        if (changeSpan)
          changeSpan.textContent = (stock.changePercent?.toFixed(2) ?? "--") + "%";

        item.classList.remove("positive", "negative", "neutral");
        item.classList.add(
          stock.changePercent > 0 ? "positive" :
          stock.changePercent < 0 ? "negative" : "neutral"
        );
      });
    });

    // Update timestamp
    const timestamp = document.querySelector(".bitunix-timestamp");
    if (timestamp && this.state.lastUpdate) {
      timestamp.textContent = moment(this.state.lastUpdate).format("HH:mm:ss");
    }

    // Initialize continuous scroll animation (once)
    const frame = document.querySelector(".bitunix-tickerframe");
    if (frame && !frame.dataset.scrollInit) {
      frame.innerHTML += frame.innerHTML;
      frame.dataset.scrollInit = "true";
      frame.style.whiteSpace = "nowrap";
      frame.style.display = "flex";
      frame.style.position = "relative";
      frame.style.left = "0px";

      const speed = this.config.scrollSpeed;
      let pos = 0;

      const animate = () => {
        pos -= speed / 60;

        if (Math.abs(pos) >= frame.scrollWidth / 2) {
          pos = 0;
        }

        frame.style.transform = `translate3d(${pos}px, 0, 0)`;
        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    }
  },

  getTemplateData() {
    return {
      config: this.config,
      stocks: this.state.stocks || [],
      lastUpdate: this.state.lastUpdate
        ? moment(this.state.lastUpdate).format("HH:mm:ss")
        : null
    };
  }
});

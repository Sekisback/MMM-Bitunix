// Module-Registrierung mit Config
Module.register("MMM-Bitunix", {
  // Standard-Konfiguration
  defaults: {
    stocks: [],
    showChangePercent: true,
    scrollSpeed: 50,              // px/s (0 = kein Scroll)
    displayMode: "horizontal",    // oder "vertical", "none"
    fadeSpeedInSeconds: 3.5
  },

  // CSS-Datei laden
  getStyles() {
    return ["MMM-Bitunix.css"];
  },

  // Template laden
  getTemplate() {
    return "templates/MMM-Bitunix.njk";
  },

  // Modul starten
  start() {
    // Initial State setzen
    this.state = { stocks: [], lastUpdate: null };
    this.initialRender = true;
    this.pendingUpdate = null;
    
    // Prüfen ob Stocks konfiguriert
    if (!this.config.stocks || this.config.stocks.length === 0) {
      Log.warn("[MMM-Bitunix] No stocks defined in config.js");
      return;
    }

    // Initiale Daten vom Node-Helper anfordern
    this.sendSocketNotification(
      `BITUNIX_TICKER_REQUEST-${this.identifier}`, 
      { stocks: this.config.stocks }
    );
  },

  // Socket-Benachrichtigungen empfangen
  socketNotificationReceived(notification, payload) {
    // Richtige Benachrichtigung prüfen
    const expected = `BITUNIX_TICKER_RESPONSE-${this.identifier}`;
    
    if (notification === expected) {
      // Nur beim ersten Mal: kompletter Rerender
      if (this.initialRender) {
        this.state = payload;
        this.updateDom();
        this.initialRender = false;
        // Nach erstem Render: Animation einrichten
        setTimeout(() => this.setupScrollAnimation(), 500);
      } else {
        // Danach: State direkt aktualisieren
        this.state = payload;
        // Und sofort Preise updaten
        this.updatePriceValues();
      }
    }
  },

  // Nur Preis-Werte updaten (HTML bleibt gleich)
  updatePriceValues() {
    if (!this.state.stocks || this.state.stocks.length === 0) return;

    // Jedes Stock aktualisieren
    this.state.stocks.forEach(stock => {
      const symbol = stock.symbol ? stock.symbol.toUpperCase() : null;
      const selector = `[data-symbol="${symbol}"]`;
      const items = document.querySelectorAll(selector);

      // Update ALLE Items (beide Kopien müssen gleich sein)
      items.forEach(item => {
        // Dezimalstellen basierend auf Preis
        let decimals = this.getDecimals(stock.lastPrice);
        
        // Preis aktualisieren
        const priceSpan = item.querySelector(".price");
        if (priceSpan) {
          priceSpan.textContent = stock.lastPrice.toFixed(decimals);
        }

        // Prozent mit Klammern aktualisieren
        const changeSpan = item.querySelector(".change");
        if (changeSpan) {
          const percent = stock.changePercent ? stock.changePercent.toFixed(2) : "0.00";
          changeSpan.textContent = `(${percent}%)`;
        }

        // Farb-Klasse aktualisieren
        item.classList.remove("positive", "negative", "neutral");
        const colorClass = 
          stock.changePercent > 0 ? "positive" :
          stock.changePercent < 0 ? "negative" : "neutral";
        item.classList.add(colorClass);
      });
    });
  },

  // Dezimalstellen basierend auf Preisgröße
  getDecimals(price) {
    if (price < 1) return 6;
    if (price < 10) return 4;
    if (price < 100) return 3;
    return 2;
  },

  // Scroll-Animation einrichten (JavaScript-basiert)
  setupScrollAnimation() {
    const frame = document.querySelector(".bitunix-tickerframe");
    
    // Abbrechen wenn kein Frame oder Scroll deaktiviert
    if (!frame || !this.config.scrollSpeed || 
        this.config.scrollSpeed <= 0) {
      return;
    }

    // Duplizierung nur beim ersten Mal
    if (!frame.dataset.scrollInit) {
      frame.dataset.scrollInit = "true";
      
      // Original-HTML speichern
      const originalHTML = frame.innerHTML;
      
      // Komplett verdoppeln (mit Marker!)
      frame.innerHTML = originalHTML + originalHTML;
      
      // Browser neu layouten
      frame.offsetHeight;
    }

    // ECHTE scrollWidth nach Duplizierung verwenden
    const fullWidth = frame.scrollWidth / 2;
    const speed = this.config.scrollSpeed;
    
    // Animation-State
    let scrollPos = 0;
    let lastTime = Date.now();

    // Continuous Animation mit requestAnimationFrame
    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      // Position vorwärts
      scrollPos += speed * deltaTime;

      // Reset bei fullWidth
      if (scrollPos >= fullWidth) {
        scrollPos = scrollPos - fullWidth;
      }

      // Auf ganze Pixel runden (Sub-Pixel-Problem beheben)
      const roundedPos = Math.round(scrollPos);

      // Transform anwenden mit gerundeter Position
      frame.style.transform = `translateX(-${roundedPos}px)`;
      
      // Nächster Frame
      requestAnimationFrame(animate);
    };

    // Animation starten
    requestAnimationFrame(animate);
  },

  // Nächsten Update am Ende der Animation planen
  scheduleNextUpdate() {
    // Wenn bereits geplant oder keine Daten ausstehend
    if (this.updateScheduled) return;

    this.updateScheduled = true;

    // Nach einer vollständigen Animation-Runde updaten
    setTimeout(() => {
      // Wenn neue Daten vorhanden: anwenden
      if (this.pendingUpdate) {
        this.state = this.pendingUpdate;
        this.pendingUpdate = null;
        
        // Nur Werte updaten
        this.updatePriceValues();
      }
      
      // Scheduler zurücksetzen für nächste Runde
      this.updateScheduled = false;
      this.scheduleNextUpdate();
    }, this.animationDuration);
  },

  // Template-Daten vorbereiten
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
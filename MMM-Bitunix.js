// Module-Registrierung mit Config
Module.register("MMM-Bitunix", {
  // Standard-Konfiguration
  defaults: {
    stocks: [],
    fadingSpeed: 3,
    fadingTime: 1.5,
    showChangePercent: true,
    updateInterval: 30000
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
    // State initialisieren
    this.state = { stocks: [], lastUpdate: null };
    this.pendingState = null;
    this.currentIndex = 0;
    this.currentStock = null;
    this.rotationInterval = null;
    this.updateInterval = null;
    
    console.log("[MMM-Bitunix] Config:", this.config);
    
    // Prüfen ob Stocks konfiguriert
    if (!this.config.stocks || this.config.stocks.length === 0) {
      console.warn("[MMM-Bitunix] No stocks defined in config.js");
      return;
    }

    console.log("[MMM-Bitunix] Stocks:", this.config.stocks.map(s => s.symbol));

    // Erste Daten vom Node-Helper anfordern
    console.log("[MMM-Bitunix] Sende Anfrage an Node Helper");
    this.sendSocketNotification("BITUNIX_REQUEST_TICKERS", {
      stocks: this.config.stocks
    });
  },

  // Socket-Benachrichtigungen empfangen
  socketNotificationReceived(notification, payload) {
    console.log("[MMM-Bitunix] Socket:", notification, payload);
    
    if (notification === "BITUNIX_TICKERS_RESPONSE") {
      console.log("[MMM-Bitunix] Tickers erhalten:", payload);
      
      // Wenn noch keine Rotation läuft: Sofort verwenden
      if (!this.rotationInterval) {
        this.state.stocks = payload.stocks;
        this.state.lastUpdate = payload.lastUpdate;
        
        console.log("[MMM-Bitunix] State.stocks jetzt:", this.state.stocks.length, "Stocks");
        
        this.currentIndex = 0;
        
        if (this.state.stocks.length > 0) {
          this.currentStock = this.state.stocks[0];
          console.log("[MMM-Bitunix] Setze Stock:", this.currentStock.symbol);
        }
        
        this.startRotation();
      } else {
        // Rotation läuft: Preise updaten (nicht die Array-Struktur ändern!)
        console.log("[MMM-Bitunix] Preise updaten im Durchlauf");
        
        // Für jeden Stock die neuen Preise übernehmen
        payload.stocks.forEach(newStock => {
          const existingStock = this.state.stocks.find(s => s.symbol === newStock.symbol);
          if (existingStock) {
            existingStock.lastPrice = newStock.lastPrice;
            existingStock.changePercent = newStock.changePercent;
          }
        });
        
        this.state.lastUpdate = payload.lastUpdate;
        
        // NUR die DOM-Werte updaten, nicht updateDom() aufrufen
        const affectedStock = payload.stocks.find(s => s.symbol === this.currentStock.symbol);
        if (affectedStock) {
          console.log("[MMM-Bitunix] Nur Werte updaten für:", affectedStock.symbol);
          this.updatePriceInDOM();
        }
      }
    }
  },

  // Rotation starten
  startRotation() {
    if (!this.state.stocks || this.state.stocks.length === 0) {
      console.warn("[MMM-Bitunix] Keine Stocks vorhanden");
      return;
    }

    // Ersten Stock anzeigen
    this.currentIndex = 0;
    this.currentStock = this.state.stocks[this.currentIndex];
    
    console.log("[MMM-Bitunix] Rotation gestartet mit:", this.currentStock.symbol);
    
    this.updateDom();

    // Gesamtdauer pro Coin = einblenden + sichtbar + ausblenden
    const cycleDuration = (this.config.fadingTime + this.config.fadingSpeed + this.config.fadingTime) * 1000;
    
    this.rotationInterval = setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.state.stocks.length;
      this.currentStock = this.state.stocks[this.currentIndex];
      
      console.log("[MMM-Bitunix] Zeige:", this.currentStock.symbol);
      
      this.updateDom();
      
      // Nach vollständigem Durchlauf: Neue Preise holen
      if (this.currentIndex === 0) {
        console.log("[MMM-Bitunix] Durchlauf komplett - Neue Preise holen");
        this.sendSocketNotification("BITUNIX_REQUEST_TICKERS", {
          stocks: this.config.stocks
        });
      }
    }, cycleDuration);
  },

  // Dezimalstellen basierend auf Preisgröße
  getDecimals(price) {
    if (price < 1) return 6;
    if (price < 10) return 4;
    if (price < 100) return 3;
    return 2;
  },

  // Nur Preis im DOM updaten (kein Re-Render)
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
    
    // Farben updaten
    if (itemDiv) {
      itemDiv.classList.remove("positive", "negative", "neutral");
      const colorClass = 
        this.currentStock.changePercent > 0 ? "positive" :
        this.currentStock.changePercent < 0 ? "negative" : "neutral";
      itemDiv.classList.add(colorClass);
    }
  },

  // Template-Daten vorbereiten
  getTemplateData() {
    let stock = null;
    let decimals = 2;
    
    // Nur wenn currentStock existiert
    if (this.currentStock && this.currentStock.symbol) {
      decimals = this.getDecimals(this.currentStock.lastPrice);
      
      // Fade-Dauer = einblenden + sichtbar + ausblenden
      const fadeDuration = this.config.fadingTime + this.config.fadingSpeed + this.config.fadingTime;
      
      stock = {
        ...this.currentStock,
        decimals: decimals,
        cleanSymbol: this.currentStock.symbol.replace("USDT", ""),
        fadeDuration: fadeDuration,
        fadingTime: this.config.fadingTime,
        fadingSpeed: this.config.fadingSpeed
      };
    }
    
    return {
      config: this.config,
      stock: stock,
      lastUpdate: this.state.lastUpdate
        ? moment(this.state.lastUpdate).format("HH:mm:ss")
        : null
    };
  },

  // Animation resetten nach DOM-Update
  notificationReceived(notification) {
    if (notification === "DOM_OBJECTS_CREATED") {
      // Animation neu starten
      const wrapper = document.querySelector(".MMM-Bitunix .bitunix-wrapper");
      if (wrapper) {
        wrapper.style.animation = "none";
        setTimeout(() => {
          const fadeDuration = this.config.fadingSpeed + this.config.fadingTime;
          wrapper.style.animation = `fadeInOut ${fadeDuration}s ease-in-out forwards`;
        }, 10);
      }
    }
  }
});
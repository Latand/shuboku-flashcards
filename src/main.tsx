import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installWheelFallback } from "./lib/scroll";
import { startVoiceDiscovery } from "./lib/speech";
import "./styles.css";

installWheelFallback();
// Voice lists can take seconds to arrive; start asking before the first card.
startVoiceDiscovery();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

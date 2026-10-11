import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installWheelFallback } from "../../src/lib/scroll";
import { App } from "./App";
import { initTelegramShell } from "./lib/tg";
import "./styles.css";

initTelegramShell();
installWheelFallback();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

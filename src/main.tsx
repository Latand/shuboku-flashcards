import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installWheelFallback } from "./lib/scroll";
import "./styles.css";

installWheelFallback();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

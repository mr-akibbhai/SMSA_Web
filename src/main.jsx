import React from "react";
import ReactDOM from "react-dom/client";
import { LanguageProvider } from "./lib/i18n";
import App from "./App.jsx";
import "./styles.css";
import "./redesign.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider><App /></LanguageProvider>
  </React.StrictMode>
);

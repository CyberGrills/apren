import React from "react";
import { createRoot } from "react-dom/client";

import { AssetProvider } from "./context/AssetContext";
import AprenApp from "./features/apren/AprenApp.jsx";

createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <AssetProvider>
      <AprenApp />
    </AssetProvider>
  </React.StrictMode>
);

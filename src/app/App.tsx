import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";

/**
 * Root application component.
 * Wraps the app in providers (Router, Redux store, i18n — added in later phases).
 */
function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;

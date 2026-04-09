import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store } from "./store";
import { AppRoutes } from "./routes/AppRoutes";

/**
 * Root application component.
 * Wraps the app in providers: Redux store, Router, i18n.
 */
function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Provider>
  );
}

export default App;

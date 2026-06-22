import { AuthProvider } from "./context/AuthContext";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { AppRoutes } from "./routes/AppRoutes";

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

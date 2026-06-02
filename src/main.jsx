import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './pwa.css'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import RecaptchaLoader from './components/RecaptchaLoader'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#111', color: '#fff', fontFamily: 'sans-serif', padding: '2rem', textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Algo deu errado</h1>
          <p style={{ color: '#aaa', marginBottom: '1.5rem', maxWidth: 400 }}>
            O aplicativo encontrou um erro inesperado. Tente recarregar a página.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '0.75rem 2rem', background: '#57B952', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700 }}
          >
            Recarregar
          </button>
          {import.meta.env.DEV && (
            <pre style={{ marginTop: '2rem', color: '#ef4444', fontSize: '0.75rem', textAlign: 'left', maxWidth: 600, overflow: 'auto' }}>
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <RecaptchaLoader>
          <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
            <AuthProvider>
              <App />
            </AuthProvider>
          </ThemeProvider>
        </RecaptchaLoader>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Frontend render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="auth-screen">
          <section className="auth-card error-card">
            <h1>Frontend error</h1>
            <p>{this.state.error.message}</p>
            <pre>{this.state.error.stack}</pre>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

